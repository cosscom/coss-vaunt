import type { FloorRect, ShadowFootprint } from "@coss/vaunt-engine/stage/device-pose";
import { ShaderMaterial, Vector2 } from "three";

/** Falloff of the tight contact shadow and the wide ambient one, in device heights. */
const CONTACT_SOFTNESS = 0.045;
const AMBIENT_SOFTNESS = 0.22;
const AMBIENT_SHARE = 0.35;

const vertexShader = /* glsl */ `
varying vec2 vFloor;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vFloor = world.xz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/** Two Gaussian falloffs from rectangles on the floor: where the device touches, and under all of it. */
const fragmentShader = /* glsl */ `
uniform vec2 axis;
uniform vec2 contactCentre;
uniform vec2 contactHalf;
uniform vec2 outlineCentre;
uniform vec2 outlineHalf;
uniform float strength;
varying vec2 vFloor;

float falloff(vec2 centre, vec2 halfSize, float softness) {
  vec2 offset = vFloor - centre;
  vec2 local = vec2(dot(offset, axis), dot(offset, vec2(-axis.y, axis.x)));
  float distance = length(max(abs(local) - halfSize, 0.0)) / softness;
  return exp(-2.0 * distance * distance);
}

void main() {
  float contact = falloff(contactCentre, contactHalf, ${CONTACT_SOFTNESS.toFixed(3)});
  float ambient = falloff(outlineCentre, outlineHalf, ${AMBIENT_SOFTNESS.toFixed(3)});
  float alpha = strength * mix(contact, ambient, ${AMBIENT_SHARE.toFixed(2)});
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
}
`;

/** How far past the outline the shadow plane must reach for the ambient falloff to fade out. */
export const SHADOW_MARGIN = AMBIENT_SOFTNESS * 2.5;

type ShadowUniforms = {
  axis: { value: Vector2 };
  contactCentre: { value: Vector2 };
  contactHalf: { value: Vector2 };
  outlineCentre: { value: Vector2 };
  outlineHalf: { value: Vector2 };
  strength: { value: number };
};

export type ShadowMaterial = ShaderMaterial & {
  uniforms: ShadowUniforms;
  setFootprint: (footprint: ShadowFootprint, strength: number) => void;
};

export function createShadowMaterial(): ShadowMaterial {
  const uniforms: ShadowUniforms = {
    axis: { value: new Vector2(1, 0) },
    contactCentre: { value: new Vector2() },
    contactHalf: { value: new Vector2() },
    outlineCentre: { value: new Vector2() },
    outlineHalf: { value: new Vector2() },
    strength: { value: 0 },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });
  const setRect = (centre: Vector2, half: Vector2, rect: FloorRect) => {
    centre.set(...rect.centre);
    half.set(rect.width / 2, rect.depth / 2);
  };
  return Object.assign(material, {
    uniforms,
    setFootprint(footprint: ShadowFootprint, strength: number) {
      uniforms.axis.value.set(...footprint.axis);
      setRect(uniforms.contactCentre.value, uniforms.contactHalf.value, footprint.contact);
      setRect(uniforms.outlineCentre.value, uniforms.outlineHalf.value, footprint.outline);
      uniforms.strength.value = strength;
    },
  });
}
