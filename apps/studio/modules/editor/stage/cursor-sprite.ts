import type { CursorPlaneLayout, PlaneQuad } from "@calcom/product-video/stage/cursor-plane-layout";
import type { CursorStyle } from "@calcom/product-video/storyboard/storyboard-schema";
import { type CanvasTexture, Matrix4, Mesh, type PlaneGeometry } from "three";
import { createCursorRippleMaterial, createCursorSpriteMaterial } from "./cursor-materials";
import { createCursorTexture } from "./cursor-shapes";

/** World units in front of the screen, along its normal; the device is 1 unit tall. */
const LIFT = 0.002;

export type CursorDraw = {
  layout: CursorPlaneLayout;
  style: CursorStyle;
  opacity: number;
  blur: number;
  theme: "light" | "dark";
};

export type CursorSprite = {
  meshes: Mesh[];
  /** `device` maps the unit plane to the screen in world space; null hides the cursor. */
  update: (device: Matrix4, draw: CursorDraw | null) => void;
  dispose: () => void;
};

/** The cursor and its click ripple as quads just in front of the screen, so they turn, zoom and blur with it. */
export function createCursorSprite({
  geometry,
  maxAnisotropy,
  renderOrder,
  layer,
}: {
  geometry: PlaneGeometry;
  maxAnisotropy: number;
  renderOrder: number;
  layer: number;
}): CursorSprite {
  const textures = new Map<CursorStyle, CanvasTexture>();
  const spriteMaterial = createCursorSpriteMaterial();
  const rippleMaterial = createCursorRippleMaterial();
  const sprite = new Mesh(geometry, spriteMaterial);
  const ripple = new Mesh(geometry, rippleMaterial);
  for (const [index, mesh] of [ripple, sprite].entries()) {
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = renderOrder + index;
    mesh.layers.set(layer);
    mesh.visible = false;
  }
  const local = new Matrix4();

  const place = (mesh: Mesh, device: Matrix4, quad: PlaneQuad, lift: number) => {
    local.makeScale(quad.width, quad.height, 1).setPosition(quad.x, quad.y, lift);
    mesh.matrix.multiplyMatrices(device, local);
    mesh.matrixWorldNeedsUpdate = true;
  };

  const textureFor = (style: CursorStyle) => {
    let texture = textures.get(style);
    if (!texture) {
      texture = createCursorTexture(style, maxAnisotropy);
      textures.set(style, texture);
    }
    return texture;
  };

  return {
    meshes: [ripple, sprite],
    update(device, draw) {
      sprite.visible = draw !== null;
      ripple.visible = draw?.layout.ripple != null;
      if (!draw) return;
      place(sprite, device, draw.layout.sprite, LIFT * 2);
      spriteMaterial.uniforms.map.value = textureFor(draw.style);
      spriteMaterial.uniforms.opacity.value = draw.opacity;
      spriteMaterial.uniforms.blur.value = draw.blur;
      const ring = draw.layout.ripple;
      if (!ring) return;
      place(ripple, device, ring, LIFT);
      rippleMaterial.uniforms.color.value.set(draw.theme === "dark" ? "#ffffff" : "#111111");
      rippleMaterial.uniforms.opacity.value = ring.opacity * draw.opacity;
      rippleMaterial.uniforms.thickness.value = ring.thickness;
    },
    dispose() {
      for (const texture of textures.values()) texture.dispose();
      spriteMaterial.dispose();
      rippleMaterial.dispose();
    },
  };
}
