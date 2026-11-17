import type { PropertyValues } from "../storyboard/property-evaluation";
import {
  type CameraRig,
  cameraRig,
  type LayerPlacement,
  layerPlacement,
  type Size,
  type Vec3,
} from "./camera-rig";
import { type DevicePose, devicePose, transform } from "./device-pose";

/** Everything the stage used to draw one clip, so overlays and canvas tools can project onto it. */
export type LayerGeometry = {
  rig: CameraRig;
  pose: DevicePose;
  device: Size;
  placement: LayerPlacement;
  frame: Size;
};

/** `view` sets the camera and device; `placement` the clip's scale and position, which transitions change. */
export function layerGeometry(
  view: PropertyValues,
  placement: Pick<PropertyValues, "scale" | "x" | "y">,
  device: Size,
  frame: Size
): LayerGeometry {
  return {
    rig: cameraRig(view, device, frame),
    pose: devicePose(view, device),
    device,
    placement: layerPlacement(placement),
    frame,
  };
}

/** A point in the frame in CSS px (y down), and its distance in front of the camera. */
export type FramePoint = { x: number; y: number; depth: number };

const DEG = Math.PI / 180;

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const normalise = (v: Vec3): Vec3 => {
  const length = Math.hypot(...v) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};

/** The camera's axes, as three's `lookAt` builds them. */
export function cameraBasis(rig: CameraRig): { forward: Vec3; right: Vec3; up: Vec3 } {
  const forward = normalise(sub(rig.target, rig.position));
  const right = normalise(cross(forward, rig.up));
  return { forward, right, up: cross(right, forward) };
}

/** Distance of a world point in front of the camera, along its view axis. */
export function viewDepth(rig: CameraRig, point: Vec3): number {
  return dot(sub(point, rig.position), cameraBasis(rig).forward);
}

/** Projects a world point through the camera and the clip's placement, as the stage draws it. */
export function projectToFrame(geometry: LayerGeometry, point: Vec3): FramePoint {
  const { rig, placement, frame } = geometry;
  const { forward, right, up } = cameraBasis(rig);
  const relative = sub(point, rig.position);
  const depth = dot(relative, forward);
  const halfTan = Math.tan((rig.fov * DEG) / 2);
  const aspect = frame.width / frame.height;
  const ndcX = placement.scale * (dot(relative, right) / depth / (halfTan * aspect)) + placement.offsetX;
  const ndcY = placement.scale * (dot(relative, up) / depth / halfTan) + placement.offsetY;
  return { x: ((ndcX + 1) / 2) * frame.width, y: ((1 - ndcY) / 2) * frame.height, depth };
}

/** World point on the device for a point in device fractions: −1..1 edge to edge, y down. */
export function devicePoint(geometry: Pick<LayerGeometry, "pose" | "device">, x: number, y: number): Vec3 {
  const { pose, device } = geometry;
  return transform(pose.rotation, [(x * device.width) / 2, (-y * device.height) / 2, 0]);
}

/**
 * Where a frame point (CSS px) lands on the device's plane, in device fractions (y down), unclamped;
 * null when the ray misses the plane.
 */
export function frameToDevice(geometry: LayerGeometry, x: number, y: number): [number, number] | null {
  const { rig, placement, frame, pose, device } = geometry;
  const { forward, right, up } = cameraBasis(rig);
  const halfTan = Math.tan((rig.fov * DEG) / 2);
  const aspect = frame.width / frame.height;
  const ndcX = ((x / frame.width) * 2 - 1 - placement.offsetX) / placement.scale;
  const ndcY = (1 - (y / frame.height) * 2 - placement.offsetY) / placement.scale;
  const direction = add(add(forward, right, ndcX * halfTan * aspect), up, ndcY * halfTan);
  const normal = transform(pose.rotation, [0, 0, 1]);
  const facing = dot(direction, normal);
  if (Math.abs(facing) < 1e-9) return null;
  const distance = -dot(rig.position, normal) / facing;
  if (distance <= 0) return null;
  const hit = add(rig.position, direction, distance);
  const [r0, r1, r2] = pose.rotation;
  const localX = r0[0] * hit[0] + r1[0] * hit[1] + r2[0] * hit[2];
  const localY = r0[1] * hit[0] + r1[1] * hit[1] + r2[1] * hit[2];
  return [localX / (device.width / 2), -localY / (device.height / 2)];
}
