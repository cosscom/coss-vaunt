import { type DepthOfFieldParams, MAX_BLUR_RADIUS } from "@calcom/product-video/stage/depth-of-field";
import type { BlurMode } from "@calcom/product-video/storyboard/storyboard-schema";
import {
  type Camera,
  DepthTexture,
  MeshBasicMaterial,
  type Scene,
  ShaderMaterial,
  UnsignedIntType,
  Vector2,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { type ClipView, NO_DEPTH_LAYER } from "./clip-view";

const MODE_INDEX: Record<BlurMode, number> = { lens: 0, radial: 1, directional: 2, "tilt-shift": 3 };

/**
 * Scatter-as-gather: a tap only counts when its own blur reaches the pixel, so a sharp device never
 * bleeds into the blurred background (BokehPass's halo). In lens mode a tap behind the pixel is capped at
 * the pixel's blur, so a blurred background never smears over a sharp edge. The tap pattern turns per
 * pixel by fixed noise, so it trades banding for grain and every frame stays a pure function of time.
 */
const fragmentShader = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 resolution;
uniform float cameraNear;
uniform float cameraFar;
uniform int mode;
uniform float maxRadius;
uniform float focusDepth;
uniform float inFocus;
uniform float ramp;
uniform vec2 focusPoint;
uniform vec2 direction;
uniform float aspect;
varying vec2 vUv;

const int TAPS = 64;
const float GOLDEN_ANGLE = 2.39996323;

float sceneDepth(vec2 uv) {
  return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar);
}

float focusOffset(vec2 uv, float depth) {
  if (mode == 0) return abs(depth - focusDepth) / focusDepth;
  vec2 p = (vec2(uv.x, 1.0 - uv.y) - focusPoint) * vec2(aspect, 1.0);
  if (mode == 3) return abs(-p.x * direction.y + p.y * direction.x);
  return length(p);
}

float blurRadius(vec2 uv, float depth) {
  return clamp((focusOffset(uv, depth) - inFocus) / ramp, 0.0, 1.0) * maxRadius;
}

float noise(vec2 pixel) {
  return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec4 centre = texture2D(tColor, vUv);
  float centreDepth = sceneDepth(vUv);
  float centreRadius = blurRadius(vUv, centreDepth);
  if (centreRadius < 0.5) {
    gl_FragColor = centre;
    return;
  }
  float jitter = noise(gl_FragCoord.xy);
  vec2 streak = vec2(direction.x, -direction.y);
  vec4 sum = centre;
  float total = 1.0;
  for (int i = 0; i < TAPS; i++) {
    float t = (float(i) + jitter) / float(TAPS);
    vec2 offset;
    float distance;
    if (mode == 2) {
      float along = t * 2.0 - 1.0;
      offset = streak * along * centreRadius;
      distance = abs(along) * centreRadius;
    } else {
      distance = sqrt(t) * centreRadius;
      float angle = float(i) * GOLDEN_ANGLE + jitter * 6.2831853;
      offset = vec2(cos(angle), sin(angle)) * distance;
    }
    vec2 uv = vUv + offset / resolution;
    float depth = sceneDepth(uv);
    float radius = blurRadius(uv, depth);
    if (mode == 0 && depth > centreDepth) radius = min(radius, centreRadius);
    float weight = smoothstep(distance - 1.0, distance + 1.0, radius);
    sum += texture2D(tColor, uv) * weight;
    total += weight;
  }
  gl_FragColor = sum / total;
}
`;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Draws into whatever target the composer hands it, so the composite can feed the blur pass. */
class CompositePass extends Pass {
  constructor(private readonly draw: () => void) {
    super();
    this.needsSwap = false;
  }

  override render(
    renderer: WebGLRenderer,
    _writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget
  ): void {
    renderer.setRenderTarget(readBuffer);
    this.draw();
  }
}

/** Renders the focused clip's scene depth, then blurs the composite by each pixel's circle of confusion. */
class BlurPass extends Pass {
  readonly material = new ShaderMaterial({
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      resolution: { value: new Vector2(1, 1) },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 100 },
      mode: { value: 0 },
      maxRadius: { value: 0 },
      focusDepth: { value: 1 },
      inFocus: { value: 0 },
      ramp: { value: 1 },
      focusPoint: { value: new Vector2(0.5, 0.5) },
      direction: { value: new Vector2(1, 0) },
      aspect: { value: 1 },
    },
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  private readonly quad = new FullScreenQuad(this.material);
  private readonly depthTarget = new WebGLRenderTarget(1, 1, {
    depthTexture: new DepthTexture(1, 1, UnsignedIntType),
  });
  private readonly depthOnly = new MeshBasicMaterial({ colorWrite: false });
  scene: Scene | null = null;
  camera: Camera | null = null;

  override setSize(width: number, height: number): void {
    this.depthTarget.setSize(width, height);
    this.material.uniforms.resolution.value.set(width, height);
  }

  override render(
    renderer: WebGLRenderer,
    writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget
  ): void {
    if (this.scene && this.camera) {
      const override = this.scene.overrideMaterial;
      this.scene.overrideMaterial = this.depthOnly;
      this.camera.layers.disable(NO_DEPTH_LAYER);
      renderer.setRenderTarget(this.depthTarget);
      renderer.clear();
      renderer.render(this.scene, this.camera);
      this.camera.layers.enable(NO_DEPTH_LAYER);
      this.scene.overrideMaterial = override;
    }
    this.material.uniforms.tColor.value = readBuffer.texture;
    this.material.uniforms.tDepth.value = this.depthTarget.depthTexture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  override dispose(): void {
    this.material.dispose();
    this.quad.dispose();
    this.depthTarget.depthTexture?.dispose();
    this.depthTarget.dispose();
    this.depthOnly.dispose();
  }
}

export type DepthOfField = {
  /** Draws the composite blurred by `params`, using `view`'s depth. */
  render: (view: ClipView, params: DepthOfFieldParams) => void;
  setSize: (width: number, height: number, pixelRatio: number) => void;
  dispose: () => void;
};

export function createDepthOfField(renderer: WebGLRenderer, drawComposite: () => void): DepthOfField {
  const composer = new EffectComposer(renderer);
  const blur = new BlurPass();
  composer.addPass(new CompositePass(drawComposite));
  composer.addPass(blur);
  composer.addPass(new OutputPass());
  let bufferHeight = 1;

  return {
    render(view, params) {
      blur.scene = view.scene;
      blur.camera = view.camera;
      const uniforms = blur.material.uniforms;
      uniforms.cameraNear.value = view.camera.near;
      uniforms.cameraFar.value = view.camera.far;
      uniforms.mode.value = MODE_INDEX[params.mode];
      uniforms.maxRadius.value = params.strength * MAX_BLUR_RADIUS * bufferHeight;
      uniforms.focusDepth.value = Math.max(1e-4, params.focusDepth);
      uniforms.inFocus.value = params.inFocus;
      uniforms.ramp.value = params.ramp;
      uniforms.focusPoint.value.set(...params.focusPoint);
      uniforms.direction.value.set(...params.direction);
      uniforms.aspect.value = params.aspect;
      composer.render();
    },
    setSize(width, height, pixelRatio) {
      bufferHeight = height * pixelRatio;
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    dispose() {
      blur.dispose();
      composer.dispose();
    },
  };
}
