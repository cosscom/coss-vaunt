import type { PropertyValues } from "../storyboard/property-evaluation";
import { type LayerGeometry, projectToFrame } from "./camera-projection";
import type { Vec3 } from "./camera-rig";
import { deviceRotation, transform } from "./device-pose";

export type Point = [number, number];
export type RotationKey = "rotateX" | "rotateY" | "rotateZ";
export const ROTATION_KEYS: readonly RotationKey[] = ["rotateX", "rotateY", "rotateZ"];

/** A ring in frame CSS px; `front` marks points nearer the camera than the pivot. */
export type GizmoRing = { key: RotationKey; points: Point[]; front: boolean[]; axis: Point };

export type RotationGizmo = {
  pivot: Point;
  rings: GizmoRing[];
  /** Tips of the device's own right, up and out-of-face axes. */
  arrows: { x: Point; y: Point; z: Point };
};

/** Gizmo sizes in device heights. */
const RING_RADIUS = 0.32;
const ARROW_LENGTH = 0.42;
const Z_ARROW_LENGTH = 0.2;
const RING_SEGMENTS = 96;
/** Below this, a ring is too edge-on for the angle around its centre to mean anything. */
const MIN_FACING = 0.25;
const DEG = 180 / Math.PI;

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalise = (v: Vec3): Vec3 => scale(v, 1 / (Math.hypot(...v) || 1));

/**
 * The world axis each property turns the device about. Rotation is Ry·Rx·Rz, so Y turns about the world's
 * up, X about the device's right before X and Z are applied, and Z about the device's face normal; a ring
 * drag on one axis therefore changes exactly one property, with the inspector sphere's signs.
 */
export function rotationAxis(values: Pick<PropertyValues, RotationKey>, key: RotationKey): Vec3 {
  if (key === "rotateY") return [0, 1, 0];
  if (key === "rotateX")
    return transform(deviceRotation({ rotateX: 0, rotateY: values.rotateY, rotateZ: 0 }), [1, 0, 0]);
  return transform(deviceRotation(values), [0, 0, 1]);
}

function project(geometry: LayerGeometry, point: Vec3): Point {
  const { x, y } = projectToFrame(geometry, point);
  return [x, y];
}

/** Rings and arrows at the device's centre, which is its pivot. */
export function rotationGizmo(
  geometry: LayerGeometry,
  values: Pick<PropertyValues, RotationKey>
): RotationGizmo {
  const height = geometry.device.height;
  const pivotDepth = projectToFrame(geometry, [0, 0, 0]).depth;
  const rings = ROTATION_KEYS.map((key): GizmoRing => {
    const axis = rotationAxis(values, key);
    const helper: Vec3 = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = normalise(cross(axis, helper));
    const v = cross(axis, u);
    const points: Point[] = [];
    const front: boolean[] = [];
    for (let index = 0; index <= RING_SEGMENTS; index++) {
      const angle = (index / RING_SEGMENTS) * Math.PI * 2;
      const world = scale(add(scale(u, Math.cos(angle)), scale(v, Math.sin(angle))), RING_RADIUS * height);
      const projected = projectToFrame(geometry, world);
      points.push([projected.x, projected.y]);
      front.push(projected.depth <= pivotDepth);
    }
    const tip = project(geometry, scale(axis, height));
    const pivot = project(geometry, [0, 0, 0]);
    return { key, points, front, axis: [tip[0] - pivot[0], tip[1] - pivot[1]] };
  });
  const rotation = deviceRotation(values);
  const along = (local: Vec3, length: number) =>
    project(geometry, scale(transform(rotation, local), length * height));
  return {
    pivot: project(geometry, [0, 0, 0]),
    rings,
    arrows: {
      x: along([1, 0, 0], ARROW_LENGTH),
      y: along([0, 1, 0], ARROW_LENGTH),
      z: along([0, 0, 1], Z_ARROW_LENGTH),
    },
  };
}

function segmentDistance([px, py]: Point, [ax, ay]: Point, [bx, by]: Point): number {
  const [dx, dy] = [bx - ax, by - ay];
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / length));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** The ring under a frame point, nearest first, within `tolerance` px. */
export function hitRing(gizmo: RotationGizmo, point: Point, tolerance = 8): RotationKey | null {
  let best: { key: RotationKey; distance: number } | null = null;
  for (const ring of gizmo.rings) {
    for (let index = 1; index < ring.points.length; index++) {
      const distance = segmentDistance(point, ring.points[index - 1], ring.points[index]);
      if (distance <= tolerance && (!best || distance < best.distance)) best = { key: ring.key, distance };
    }
  }
  return best?.key ?? null;
}

/**
 * Degrees a pointer move from `from` to `to` (frame px) turns the device about `key`'s axis. Facing the
 * camera, it's the angle swept around the pivot; edge-on, the move along the ring's tangent at `from`.
 */
export function ringDragDegrees(
  geometry: LayerGeometry,
  values: Pick<PropertyValues, RotationKey>,
  key: RotationKey,
  from: Point,
  to: Point
): number {
  const axis = rotationAxis(values, key);
  const pivot = project(geometry, [0, 0, 0]);
  const facing = dot(axis, normalise(geometry.rig.position));
  if (Math.abs(facing) >= MIN_FACING) {
    const swept =
      Math.atan2(to[1] - pivot[1], to[0] - pivot[0]) - Math.atan2(from[1] - pivot[1], from[0] - pivot[0]);
    const wrapped = Math.atan2(Math.sin(swept), Math.cos(swept));
    // Frame y points down, so a counter-clockwise turn on screen is a negative swept angle.
    return (facing > 0 ? -wrapped : wrapped) * DEG;
  }
  const ring = rotationGizmo(geometry, values).rings.find((candidate) => candidate.key === key);
  if (!ring) return 0;
  const distance = (point: Point) => Math.hypot(point[0] - from[0], point[1] - from[1]);
  let nearest = 0;
  ring.points.forEach((point, index) => {
    if (distance(point) < distance(ring.points[nearest])) nearest = index;
  });
  const next = ring.points[(nearest + 1) % ring.points.length];
  const here = ring.points[nearest];
  const step = (Math.PI * 2) / RING_SEGMENTS;
  const tangent: Point = [(next[0] - here[0]) / step, (next[1] - here[1]) / step];
  const length = tangent[0] ** 2 + tangent[1] ** 2;
  if (length < 1e-6) return 0;
  const along = ((to[0] - from[0]) * tangent[0] + (to[1] - from[1]) * tangent[1]) / length;
  // Ring points run u → v with v = axis × u, the axis's right-hand direction.
  return along * DEG;
}
