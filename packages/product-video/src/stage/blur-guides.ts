import type { BlurSettings } from "../storyboard/storyboard-schema";
import { devicePoint, type LayerGeometry, projectToFrame, viewDepth } from "./camera-projection";
import { circleOfConfusion, type DepthOfFieldParams, surfaceToDevice } from "./depth-of-field";

export type Point = [number, number];

/** A shaded cell of the device and how blurred it is, 0 → 1. */
export type GuideCell = { points: Point[]; amount: number };

/** Radial, directional and tilt shift: the sharp area's edge as it lies on the device, in frame px. */
export type GuideFalloff = {
  shape: "circle" | "band";
  /** One closed ring for a circle, the band's two sides for tilt shift; on the device's plane, so they turn with it. */
  edges: Point[][];
  /** Tilt shift: the band's centre line across the device. */
  centreLine: [Point, Point] | null;
};

/** What the canvas draws over the stage while blur is edited, in frame CSS px. */
export type BlurGuideShapes = {
  outline: Point[];
  /** Null for manual focus, which has no point on the device. */
  focusPoint: Point | null;
  /** The device shaded by its blur. */
  cells: GuideCell[];
  /** Lens: where the device crosses the focus distance. */
  focusLine: [Point, Point] | null;
  falloff: GuideFalloff | null;
  /** Directional: the blur's direction through the focus point. */
  streak: [Point, Point] | null;
  /** Where to grab to turn the angle: the streak's head, or the end of the tilt-shift band's centre line. */
  angleHandle: Point | null;
};

const GRID = 16;
const RING_POINTS = 64;
const CORNERS: Point[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

function toFrame(geometry: LayerGeometry, [x, y]: Point): Point {
  const projected = projectToFrame(geometry, devicePoint(geometry, x, y));
  return [projected.x, projected.y];
}

/** A point in device heights from the centre, drawn in the frame; null behind the camera. */
function surfaceToFrame(geometry: LayerGeometry, surface: Point): Point | null {
  const projected = projectToFrame(geometry, devicePoint(geometry, ...surfaceToDevice(geometry, surface)));
  return projected.depth > 0 ? [projected.x, projected.y] : null;
}

/** The part of the line `from + t · direction` that crosses the device, in device heights, or null. */
function acrossDevice(geometry: LayerGeometry, from: Point, direction: Point): [Point, Point] | null {
  const half: Point = [geometry.device.width / geometry.device.height / 2, 0.5];
  let [low, high] = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
  for (const axis of [0, 1] as const) {
    if (Math.abs(direction[axis]) < 1e-9) {
      if (Math.abs(from[axis]) > half[axis]) return null;
      continue;
    }
    const [a, b] = [
      (-half[axis] - from[axis]) / direction[axis],
      (half[axis] - from[axis]) / direction[axis],
    ];
    low = Math.max(low, Math.min(a, b));
    high = Math.min(high, Math.max(a, b));
  }
  if (low >= high) return null;
  const at = (t: number): Point => [from[0] + direction[0] * t, from[1] + direction[1] * t];
  return [at(low), at(high)];
}

function projectedLine(geometry: LayerGeometry, line: [Point, Point] | null): [Point, Point] | null {
  if (!line) return null;
  const [from, to] = [surfaceToFrame(geometry, line[0]), surfaceToFrame(geometry, line[1])];
  return from && to ? [from, to] : null;
}

/** Device depth is affine across its plane, so the focus line meets the outline at two edge points. */
function focusLine(geometry: LayerGeometry, focusDepth: number): [Point, Point] | null {
  const depths = CORNERS.map(([x, y]) => viewDepth(geometry.rig, devicePoint(geometry, x, y)));
  const crossings: Point[] = [];
  CORNERS.forEach((from, index) => {
    const next = (index + 1) % CORNERS.length;
    const [a, b] = [depths[index] - focusDepth, depths[next] - focusDepth];
    if (a === b || a * b > 0) return;
    const t = a / (a - b);
    const to = CORNERS[next];
    crossings.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
  });
  const [start, end] = crossings;
  return start && end ? [toFrame(geometry, start), toFrame(geometry, end)] : null;
}

export function blurGuideShapes(
  settings: BlurSettings,
  params: DepthOfFieldParams,
  geometry: LayerGeometry,
  focus: Point
): BlurGuideShapes {
  const { frame } = geometry;
  const outline = CORNERS.map((corner) => toFrame(geometry, corner));
  const shapes: BlurGuideShapes = {
    outline,
    focusPoint: settings.mode === "lens" && settings.focus === "manual" ? null : toFrame(geometry, focus),
    cells: [],
    focusLine: null,
    falloff: null,
    streak: null,
    angleHandle: null,
  };
  for (let row = 0; row < GRID; row++) {
    for (let column = 0; column < GRID; column++) {
      const local = (i: number) => (i / GRID) * 2 - 1;
      const [x0, x1, y0, y1] = [local(column), local(column + 1), local(row), local(row + 1)];
      const middle = projectToFrame(geometry, devicePoint(geometry, (x0 + x1) / 2, (y0 + y1) / 2));
      shapes.cells.push({
        points: (
          [
            [x0, y0],
            [x1, y0],
            [x1, y1],
            [x0, y1],
          ] as Point[]
        ).map((corner) => toFrame(geometry, corner)),
        amount: circleOfConfusion(params, middle.x / frame.width, middle.y / frame.height, middle.depth),
      });
    }
  }
  if (params.mode === "lens") return { ...shapes, focusLine: focusLine(geometry, params.focusDepth) };

  const [fx, fy] = params.surfaceFocus;
  const [ax, ay] = params.surfaceDirection;
  const inner = params.inFocus;
  const reach = params.inFocus + params.ramp;
  const along = (distance: number): Point => [fx + ax * distance, fy + ay * distance];
  const handle = surfaceToFrame(geometry, along(reach));
  if (params.mode === "tilt-shift") {
    const normal: Point = [-ay, ax];
    const side = (offset: number) =>
      projectedLine(
        geometry,
        acrossDevice(geometry, [fx + normal[0] * offset, fy + normal[1] * offset], [ax, ay])
      );
    const edges = [side(-inner), side(inner)].filter((edge): edge is [Point, Point] => edge !== null);
    return {
      ...shapes,
      falloff: { shape: "band", edges, centreLine: side(0) },
      angleHandle: handle,
    };
  }
  const ring = Array.from({ length: RING_POINTS }, (_, index) => {
    const angle = (index / RING_POINTS) * Math.PI * 2;
    return surfaceToFrame(geometry, [fx + Math.cos(angle) * inner, fy + Math.sin(angle) * inner]);
  }).filter((point): point is Point => point !== null);
  const falloff: GuideFalloff = { shape: "circle", edges: [ring], centreLine: null };
  if (params.mode !== "directional") return { ...shapes, falloff };
  return {
    ...shapes,
    falloff,
    streak: projectedLine(geometry, [along(-reach), along(reach)]),
    angleHandle: handle,
  };
}
