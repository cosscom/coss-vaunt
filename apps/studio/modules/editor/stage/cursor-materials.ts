import { Color, ShaderMaterial, type Texture } from "three";

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Blur follows the device's transition blur with the same mip bias, so the cursor softens with the page. */
const spriteFragmentShader = /* glsl */ `
uniform sampler2D map;
uniform float opacity;
uniform float blur;
varying vec2 vUv;
void main() {
  vec4 color = texture2D(map, vUv, blur * 5.0);
  float alpha = color.a * opacity;
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(color.rgb, alpha);
  #include <colorspace_fragment>
}
`;

/** A ring drawn from its distance field, so it is crisp at any size. */
const rippleFragmentShader = /* glsl */ `
uniform vec3 color;
uniform float opacity;
uniform float thickness;
varying vec2 vUv;
void main() {
  float radius = length(vUv - 0.5) * 2.0;
  float distance = abs(radius - (1.0 - thickness * 0.5)) - thickness * 0.5;
  float edge = fwidth(distance);
  float alpha = (1.0 - smoothstep(-edge, edge, distance)) * opacity;
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;

const overlay = { transparent: true, depthWrite: false } as const;

export type CursorSpriteMaterial = ShaderMaterial & {
  uniforms: { map: { value: Texture | null }; opacity: { value: number }; blur: { value: number } };
};

export function createCursorSpriteMaterial(): CursorSpriteMaterial {
  const uniforms = { map: { value: null as Texture | null }, opacity: { value: 1 }, blur: { value: 0 } };
  const material = new ShaderMaterial({
    ...overlay,
    uniforms,
    vertexShader,
    fragmentShader: spriteFragmentShader,
  });
  return Object.assign(material, { uniforms });
}

export type CursorRippleMaterial = ShaderMaterial & {
  uniforms: { color: { value: Color }; opacity: { value: number }; thickness: { value: number } };
};

export function createCursorRippleMaterial(): CursorRippleMaterial {
  const uniforms = { color: { value: new Color() }, opacity: { value: 0 }, thickness: { value: 0.1 } };
  const material = new ShaderMaterial({
    ...overlay,
    uniforms,
    vertexShader,
    fragmentShader: rippleFragmentShader,
  });
  return Object.assign(material, { uniforms });
}
