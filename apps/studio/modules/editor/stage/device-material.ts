import { ShaderMaterial, type Texture, Vector2 } from "three";

const vertexShader = /* glsl */ `
varying vec2 vUv;
varying float vWorldY;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldY = world.y;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * Rounded corners come from a signed distance to the rounded rectangle, antialiased over one screen
 * pixel. Video textures arrive sRGB-encoded (three decodes them in its own materials, so we do too).
 * Blur is a ring of taps plus a mip bias, so it stays cheap at full strength. A reflection is drawn
 * mirrored under the floor and fades and softens with the mirrored point's height, as `reflectionAlpha` does.
 */
const fragmentShader = /* glsl */ `
uniform sampler2D map;
uniform vec2 size;
uniform float radius;
uniform float opacity;
uniform float blur;
uniform float reflection;
uniform float floorY;
uniform float fadeHeight;
uniform bool decodeSrgb;
varying vec2 vUv;
varying float vWorldY;

float roundedRectDistance(vec2 point, vec2 halfSize, float cornerRadius) {
  vec2 q = abs(point) - halfSize + cornerRadius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - cornerRadius;
}

vec4 sampleRaw(vec2 uv, float blur) {
  if (blur <= 0.0) return texture2D(map, uv);
  vec2 spread = vec2(blur * 0.02) * vec2(size.y / size.x, 1.0);
  float bias = blur * 5.0;
  vec4 color = texture2D(map, uv, bias) * 0.2;
  for (int i = 0; i < 8; i++) {
    float angle = float(i) * 0.7853982;
    color += texture2D(map, uv + vec2(cos(angle), sin(angle)) * spread, bias) * 0.1;
  }
  return color;
}

vec4 sampleFrame(vec2 uv, float blur) {
  vec4 color = sampleRaw(uv, blur);
  return decodeSrgb ? sRGBTransferEOTF(color) : color;
}

void main() {
  float distance = roundedRectDistance((vUv - 0.5) * size, size * 0.5, radius);
  float edge = fwidth(distance);
  float alpha = (1.0 - smoothstep(-edge * 0.5, edge * 0.5, distance)) * opacity;
  float frameBlur = blur;
  if (reflection >= 0.0) {
    float height = floorY - vWorldY;
    float fade = height < 0.0 ? 0.0 : max(0.0, 1.0 - height / fadeHeight);
    alpha *= reflection * fade * fade;
    frameBlur = max(blur, min(1.0, 0.1 + height * 0.9));
  }
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(sampleFrame(vUv, frameBlur).rgb, alpha);
  #include <colorspace_fragment>
}
`;

export type DeviceUniforms = {
  map: { value: Texture | null };
  size: { value: Vector2 };
  radius: { value: number };
  opacity: { value: number };
  blur: { value: number };
  /** Below 0 for the device itself; else the reflection's opacity at the floor. */
  reflection: { value: number };
  floorY: { value: number };
  fadeHeight: { value: number };
  decodeSrgb: { value: boolean };
};

export function createDeviceMaterial(): ShaderMaterial & { uniforms: DeviceUniforms } {
  const uniforms: DeviceUniforms = {
    map: { value: null },
    size: { value: new Vector2(1, 1) },
    radius: { value: 0 },
    opacity: { value: 1 },
    blur: { value: 0 },
    reflection: { value: -1 },
    floorY: { value: 0 },
    fadeHeight: { value: 1 },
    decodeSrgb: { value: false },
  };
  const material = new ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true });
  return Object.assign(material, { uniforms });
}
