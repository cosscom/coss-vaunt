import type { PropertyValues } from "../storyboard/property-evaluation";
import type { Size, Vec3 } from "./camera-rig";

/** Row-major 3×3 matrix. */
export type Mat3 = [Vec3, Vec3, Vec3];

/** A rectangle on the floor: centre (world x, z) and size along the footprint's axes. */
export type FloorRect = { centre: [number, number]; width: number; depth: number };

/**
 * The device seen from above, measured along `axis` (a unit floor direction, world x, z) and across it:
 * `outline` is all of it, `contact` only the part close enough to the floor to darken it.
 */
export type ShadowFootprint = { axis: [number, number]; outline: FloorRect; contact: FloorRect };

export type DevicePose = {
  rotation: Mat3;
  /** World height of the floor plane. */
  floorY: number;
  shadow: ShadowFootprint;
};

const DEG = Math.PI / 180;
/** Gap between the device's lowest point and the floor, in device heights. */
const FLOOR_GAP = 0.012;
/** Outline points this high above the floor, in device heights, count as touching it. */
const CONTACT_HEIGHT = 0.1;
const OUTLINE_SAMPLES_PER_EDGE = 16;
/** The reflection is gone this many device heights above the floor. */
export const REFLECTION_FADE_HEIGHT = 0.45;
export const REFLECTION_PEAK = 0.6;

function multiply(a: Mat3, b: Mat3): Mat3 {
  const cell = (row: 0 | 1 | 2, col: 0 | 1 | 2) =>
    a[row][0] * b[0][col] + a[row][1] * b[1][col] + a[row][2] * b[2][col];
  return [
    [cell(0, 0), cell(0, 1), cell(0, 2)],
    [cell(1, 0), cell(1, 1), cell(1, 2)],
    [cell(2, 0), cell(2, 1), cell(2, 2)],
  ];
}

export function transform(m: Mat3, [x, y, z]: Vec3): Vec3 {
  return [
    m[0][0] * x + m[0][1] * y + m[0][2] * z,
    m[1][0] * x + m[1][1] * y + m[1][2] * z,
    m[2][0] * x + m[2][1] * y + m[2][2] * z,
  ];
}

/**
 * The device's own rotation in world space, Ry·Rx·Rz (three's Euler "YXZ"), like the rotation sphere:
 * Y > 0 turns the face right, X > 0 turns it down, Z > 0 spins it counter-clockwise.
 */
export function deviceRotation(values: Pick<PropertyValues, "rotateX" | "rotateY" | "rotateZ">): Mat3 {
  const [cx, sx] = [Math.cos(values.rotateX * DEG), Math.sin(values.rotateX * DEG)];
  const [cy, sy] = [Math.cos(values.rotateY * DEG), Math.sin(values.rotateY * DEG)];
  const [cz, sz] = [Math.cos(values.rotateZ * DEG), Math.sin(values.rotateZ * DEG)];
  const ry: Mat3 = [
    [cy, 0, sy],
    [0, 1, 0],
    [-sy, 0, cy],
  ];
  const rx: Mat3 = [
    [1, 0, 0],
    [0, cx, -sx],
    [0, sx, cx],
  ];
  const rz: Mat3 = [
    [cz, -sz, 0],
    [sz, cz, 0],
    [0, 0, 1],
  ];
  return multiply(ry, multiply(rx, rz));
}

function corners(device: Size, rotation: Mat3): Vec3[] {
  const [w, h] = [device.width / 2, device.height / 2];
  const local: Vec3[] = [
    [-w, -h, 0],
    [w, -h, 0],
    [w, h, 0],
    [-w, h, 0],
  ];
  return local.map((corner) => transform(rotation, corner));
}

/** The device stands on the floor: it sits just under the turned device's lowest point. */
export function floorHeight(device: Size, rotation: Mat3): number {
  const lowest = Math.min(...corners(device, rotation).map(([, y]) => y));
  return lowest - FLOOR_GAP * device.height;
}

function outline(device: Size, rotation: Mat3): Vec3[] {
  const points = corners(device, rotation);
  return points.flatMap((from, i) => {
    const to = points[(i + 1) % points.length] ?? from;
    return Array.from({ length: OUTLINE_SAMPLES_PER_EDGE }, (_, step): Vec3 => {
      const t = step / OUTLINE_SAMPLES_PER_EDGE;
      return [
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
        from[2] + (to[2] - from[2]) * t,
      ];
    });
  });
}

/** Bounds of `points` along `axis` and across it, as a floor rectangle. */
function floorRect(points: Vec3[], [dx, dz]: [number, number]): FloorRect {
  const along = points.map(([x, , z]) => x * dx + z * dz);
  const across = points.map(([x, , z]) => -x * dz + z * dx);
  const [a0, a1] = [Math.min(...along), Math.max(...along)];
  const [b0, b1] = [Math.min(...across), Math.max(...across)];
  const [a, b] = [(a0 + a1) / 2, (b0 + b1) / 2];
  return { centre: [a * dx - b * dz, a * dz + b * dx], width: a1 - a0, depth: b1 - b0 };
}

/** Where the device shades the floor: its longer edge on the floor sets the axis. */
export function shadowFootprint(device: Size, rotation: Mat3, floorY: number): ShadowFootprint {
  const [ax, , az] = transform(rotation, [device.width, 0, 0]);
  const [bx, , bz] = transform(rotation, [0, device.height, 0]);
  const [ux, uz] = Math.hypot(ax, az) >= Math.hypot(bx, bz) ? [ax, az] : [bx, bz];
  const length = Math.hypot(ux, uz) || 1;
  const axis: [number, number] = [ux / length, uz / length];
  const points = outline(device, rotation);
  const touching = points.filter(([, y]) => y - floorY <= CONTACT_HEIGHT * device.height);
  return { axis, outline: floorRect(points, axis), contact: floorRect(touching, axis) };
}

export function devicePose(values: PropertyValues, device: Size): DevicePose {
  const rotation = deviceRotation(values);
  const floorY = floorHeight(device, rotation);
  return { rotation, floorY, shadow: shadowFootprint(device, rotation, floorY) };
}

/**
 * Opacity of the floor reflection of a point `height` device heights above the floor, for a
 * reflection setting of `strength`; the device shader mirrors this.
 */
export function reflectionAlpha(height: number, strength: number): number {
  if (height < 0) return 0;
  const fade = Math.max(0, 1 - height / REFLECTION_FADE_HEIGHT);
  return strength * REFLECTION_PEAK * fade * fade;
}
