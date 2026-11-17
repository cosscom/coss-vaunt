import type { PropertyValues } from "../storyboard/property-evaluation";

export type Vec3 = [number, number, number];
export type Size = { width: number; height: number };

export type CameraRig = {
  position: Vec3;
  target: Vec3;
  up: Vec3;
  /** Vertical field of view in degrees. */
  fov: number;
  near: number;
  far: number;
  /** Camera to target, in world units. */
  distance: number;
};

/** 2D placement of a rendered clip in the output frame, applied after projection (NDC). */
export type LayerPlacement = { scale: number; offsetX: number; offsetY: number };

const DEG = Math.PI / 180;

const scaled = ([x, y, z]: Vec3, k: number): Vec3 => [x * k, y * k, z * k];
const sum = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** World size of a device plane: one unit tall, as wide as the source's aspect ratio. */
export function deviceWorldSize(source: Size): Size {
  return { width: source.width / source.height, height: 1 };
}

/** Camera distance at which a plane of `device` size fills `frame` without cropping (contain). */
export function fitDistance(device: Size, frame: Size, fov: number): number {
  const halfTan = Math.tan((fov * DEG) / 2);
  const aspect = frame.width / frame.height;
  return Math.max(device.height / 2 / halfTan, device.width / 2 / (halfTan * aspect));
}

/** World size of the frame at the fit distance; pan fractions are measured against it. */
export function fitFrameWorldSize(device: Size, frame: Size, fov: number): Size {
  const height = 2 * fitDistance(device, frame, fov) * Math.tan((fov * DEG) / 2);
  return { width: height * (frame.width / frame.height), height };
}

/**
 * The camera for a scene whose device sits at the origin, facing +Z. Camera X raises the camera
 * to look down, camera Y moves it to the right, camera Z rolls it counter-clockwise (the scene turns
 * clockwise in frame). Zoom dollies: 1 fits the unturned device to the frame at any field of view.
 * Pan moves the target along the frame's axes in fractions of the zoom-1 frame (y down).
 */
export function cameraRig(values: PropertyValues, device: Size, frame: Size): CameraRig {
  const fit = fitFrameWorldSize(device, frame, values.fov);
  const distance = fitDistance(device, frame, values.fov) / values.zoom;
  const elevation = values.cameraX * DEG;
  const azimuth = values.cameraY * DEG;
  const roll = values.cameraZ * DEG;
  const back: Vec3 = [
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth),
  ];
  const levelRight: Vec3 = [Math.cos(azimuth), 0, -Math.sin(azimuth)];
  const levelUp: Vec3 = [
    -Math.sin(elevation) * Math.sin(azimuth),
    Math.cos(elevation),
    -Math.sin(elevation) * Math.cos(azimuth),
  ];
  const right = sum(scaled(levelRight, Math.cos(roll)), scaled(levelUp, Math.sin(roll)));
  const up = sum(scaled(levelUp, Math.cos(roll)), scaled(levelRight, -Math.sin(roll)));
  const target = sum(scaled(right, values.panX * fit.width), scaled(up, -values.panY * fit.height));
  const reach = Math.hypot(device.width, device.height) * 1.5 + Math.hypot(...target);
  return {
    position: sum(target, scaled(back, distance)),
    target,
    up,
    fov: values.fov,
    near: Math.max(0.001, (distance - reach) * 0.5, distance * 0.01),
    far: distance + reach * 4 + 1,
    distance,
  };
}

/** Clip properties place the rendered clip in the frame: x and y are frame fractions, y down. */
export function layerPlacement(values: Pick<PropertyValues, "scale" | "x" | "y">): LayerPlacement {
  return { scale: values.scale, offsetX: 2 * values.x, offsetY: -2 * values.y };
}
