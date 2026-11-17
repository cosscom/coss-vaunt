import type { BlurSettings } from "../storyboard/storyboard-schema";
import { devicePoint, type LayerGeometry, projectToFrame, viewDepth } from "./camera-projection";
import { circleOfConfusion, type DepthOfFieldParams } from "./depth-of-field";

export type Point = [number, number];

/** A shaded cell of the device and how blurred it is, 0 → 1. */
export type GuideCell = { points: Point[]; amount: number };

/** Screen-space modes: sharp inside `inner` px of the focus point (or its line), fully blurred past `outer`. */
export type GuideFalloff = {
  shape: "circle" | "band";
  centre: Point;
  direction: Point;
  inner: number;
  outer: number;
};

/** What the canvas draws over the stage while blur is edited, in frame CSS px. */
export type BlurGuideShapes = {
  outline: Point[];
  /** Null for manual focus, which has no point on the device. */
  focusPoint: Point | null;
  /** Lens: the device shaded by its blur. */
  cells: GuideCell[];
  /** Lens: where the device crosses the focus distance. */
  focusLine: [Point, Point] | null;
  falloff: GuideFalloff | null;
  /** Directional: the blur's direction through the focus point. */
  streak: [Point, Point] | null;
};

const GRID = 16;
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
  const centre: Point = [params.focusPoint[0] * frame.width, params.focusPoint[1] * frame.height];
  const shapes: BlurGuideShapes = {
    outline,
    focusPoint: settings.mode === "lens" && settings.focus === "manual" ? null : toFrame(geometry, focus),
    cells: [],
    focusLine: null,
    falloff: null,
    streak: null,
  };
  if (params.mode === "lens") {
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
    return { ...shapes, focusLine: focusLine(geometry, params.focusDepth) };
  }
  const falloff: GuideFalloff = {
    shape: params.mode === "tilt-shift" ? "band" : "circle",
    centre,
    direction: params.direction,
    inner: params.inFocus * frame.height,
    outer: (params.inFocus + params.ramp) * frame.height,
  };
  if (params.mode !== "directional") return { ...shapes, falloff };
  const reach = falloff.outer;
  const [dx, dy] = params.direction;
  return {
    ...shapes,
    falloff,
    streak: [
      [centre[0] - dx * reach, centre[1] - dy * reach],
      [centre[0] + dx * reach, centre[1] + dy * reach],
    ],
  };
}
