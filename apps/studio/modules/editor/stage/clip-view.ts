import type { CameraRig, LayerPlacement, Size } from "@calcom/product-video/stage/camera-rig";
import {
  type DevicePose,
  REFLECTION_FADE_HEIGHT,
  REFLECTION_PEAK,
} from "@calcom/product-video/stage/device-pose";
import type { ProjectSettings } from "@calcom/product-video/storyboard/storyboard-schema";
import { Matrix4, Mesh, PerspectiveCamera, PlaneGeometry, Scene, type Texture } from "three";
import { type CursorDraw, createCursorSprite } from "./cursor-sprite";
import { createDeviceMaterial } from "./device-material";
import { createShadowMaterial, SHADOW_MARGIN } from "./shadow-material";

/** Corner radius is set in px of a device drawn 1080 px tall. */
const RADIUS_REFERENCE_PX = 1080;
const SHADOW_LIFT = 0.001;

/** The clip's camera, with its placement (scale and offset) applied after projection. */
function aimCamera(
  camera: PerspectiveCamera,
  rig: CameraRig,
  placement: LayerPlacement,
  frame: Size,
  placementMatrix: Matrix4
): void {
  camera.fov = rig.fov;
  camera.aspect = frame.width / frame.height;
  camera.near = rig.near;
  camera.far = rig.far;
  camera.position.set(...rig.position);
  camera.up.set(...rig.up);
  camera.lookAt(...rig.target);
  camera.updateProjectionMatrix();
  placementMatrix.set(
    placement.scale,
    0,
    0,
    placement.offsetX,
    0,
    placement.scale,
    0,
    placement.offsetY,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1
  );
  camera.projectionMatrix.premultiply(placementMatrix);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

/** The contact shadow's quad covers floor far past its visible shade, so depth of field leaves it out. */
export const NO_DEPTH_LAYER = 1;

export type ClipViewInput = {
  rig: CameraRig;
  pose: DevicePose;
  placement: LayerPlacement;
  frame: Size;
  device: Size;
  texture: Texture;
  opacity: number;
  blur: number;
  settings: ProjectSettings;
  cursor: Pick<CursorDraw, "layout" | "style"> | null;
};

/** One visible clip: its own scene and camera, so every clip keeps its own framing and perspective. */
export type ClipView = {
  scene: Scene;
  camera: PerspectiveCamera;
  update: (input: ClipViewInput) => void;
  dispose: () => void;
};

/**
 * The device turns about its centre above a level floor. Its reflection is the same plane mirrored
 * through the floor in world space, so it shows the turned device without turning with it.
 */
export function createClipView({ maxAnisotropy }: { maxAnisotropy: number }): ClipView {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const geometry = new PlaneGeometry(1, 1);

  const deviceMaterial = createDeviceMaterial();
  const device = new Mesh(geometry, deviceMaterial);
  device.matrixAutoUpdate = false;
  device.renderOrder = 2;

  const reflectionMaterial = createDeviceMaterial();
  reflectionMaterial.depthWrite = false;
  const reflection = new Mesh(geometry, reflectionMaterial);
  reflection.matrixAutoUpdate = false;
  reflection.renderOrder = 1;

  const shadowMaterial = createShadowMaterial();
  const shadow = new Mesh(geometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = 0;
  shadow.layers.set(NO_DEPTH_LAYER);
  camera.layers.enable(NO_DEPTH_LAYER);

  const cursor = createCursorSprite({ geometry, maxAnisotropy, renderOrder: 3, layer: NO_DEPTH_LAYER });

  scene.add(shadow, reflection, device, ...cursor.meshes);
  const placementMatrix = new Matrix4();
  const mirror = new Matrix4();

  return {
    scene,
    camera,
    update({ rig, pose, placement, frame, device: size, texture, opacity, blur, settings, cursor: pointer }) {
      aimCamera(camera, rig, placement, frame, placementMatrix);

      const [r0, r1, r2] = pose.rotation;
      device.matrix.set(
        r0[0] * size.width,
        r0[1] * size.height,
        r0[2],
        0,
        r1[0] * size.width,
        r1[1] * size.height,
        r1[2],
        0,
        r2[0] * size.width,
        r2[1] * size.height,
        r2[2],
        0,
        0,
        0,
        0,
        1
      );
      device.matrixWorldNeedsUpdate = true;
      cursor.update(device.matrix, pointer && { ...pointer, opacity, blur, theme: settings.theme });
      mirror.set(1, 0, 0, 0, 0, -1, 0, 2 * pose.floorY, 0, 0, 1, 0, 0, 0, 0, 1);
      reflection.matrix.multiplyMatrices(mirror, device.matrix);
      reflection.matrixWorldNeedsUpdate = true;

      const radius = (settings.device.cornerRadius / RADIUS_REFERENCE_PX) * size.height;
      for (const material of [deviceMaterial, reflectionMaterial]) {
        material.uniforms.map.value = texture;
        material.uniforms.decodeSrgb.value = "isVideoTexture" in texture;
        material.uniforms.size.value.set(size.width, size.height);
        material.uniforms.radius.value = Math.min(radius, size.width / 2, size.height / 2);
        material.uniforms.opacity.value = opacity;
        material.uniforms.blur.value = blur;
      }

      const aboveFloor = rig.position[1] > pose.floorY;
      reflection.visible = aboveFloor && settings.device.reflection > 0;
      reflectionMaterial.uniforms.reflection.value = settings.device.reflection * REFLECTION_PEAK;
      reflectionMaterial.uniforms.floorY.value = pose.floorY;
      reflectionMaterial.uniforms.fadeHeight.value = REFLECTION_FADE_HEIGHT * size.height;

      shadow.visible = aboveFloor && settings.device.contactShadow;
      const { outline } = pose.shadow;
      const side = Math.max(outline.width, outline.depth) + 2 * SHADOW_MARGIN;
      shadow.scale.set(side, side, 1);
      shadow.position.set(outline.centre[0], pose.floorY + SHADOW_LIFT, outline.centre[1]);
      shadowMaterial.setFootprint(pose.shadow, opacity * (settings.theme === "dark" ? 0.8 : 0.45));
    },
    dispose() {
      geometry.dispose();
      deviceMaterial.dispose();
      reflectionMaterial.dispose();
      shadowMaterial.dispose();
      cursor.dispose();
    },
  };
}
