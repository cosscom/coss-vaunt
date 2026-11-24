import type { CubicPoints } from "@coss/vaunt-engine/storyboard/storyboard-schema";

const PLOT_X_PAD = 0.1;
const SCALE = 100;
const SNAP = 0.05;
const PRECISION = 0.01;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, step: number) => Math.round(value / step) * step;
const tidy = (value: number) => Math.round(value * 1000) / 1000 || 0;

const NUDGES: Record<string, PlotPoint> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: -1 },
};

/** Progress shown beyond 0 and 1, so overshooting curves and handles stay on the plot. */
export const PLOT_Y_MIN = -0.25;
export const PLOT_Y_MAX = 1.25;

export const PLOT_VIEW_BOX = [
  -PLOT_X_PAD * SCALE,
  0,
  (1 + 2 * PLOT_X_PAD) * SCALE,
  (PLOT_Y_MAX - PLOT_Y_MIN) * SCALE,
].join(" ");

export type PlotPoint = { x: number; y: number };
export type HandleIndex = 0 | 1;

/** Curve space (time, progress) to view box units. */
export function toPlot(x: number, y: number): PlotPoint {
  return { x: tidy(x * SCALE), y: tidy((PLOT_Y_MAX - y) * SCALE) };
}

/** A pointer inside `rect`, the SVG's box, back to curve space. */
export function fromPointer(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number }
): PlotPoint {
  return {
    x: ((clientX - rect.left) / rect.width) * (1 + 2 * PLOT_X_PAD) - PLOT_X_PAD,
    y: PLOT_Y_MAX - ((clientY - rect.top) / rect.height) * (PLOT_Y_MAX - PLOT_Y_MIN),
  };
}

/** Places a handle on the 0.01 grid, or 0.05 when snapping, clamped to the range a keyframe stores. */
export function moveHandle(
  points: CubicPoints,
  handle: HandleIndex,
  target: PlotPoint,
  snap: boolean
): CubicPoints {
  const step = snap ? SNAP : PRECISION;
  const x = tidy(clamp(round(target.x, step), 0, 1));
  const y = tidy(clamp(round(target.y, step), -1, 2));
  const next: CubicPoints = [...points];
  next[handle * 2] = x;
  next[handle * 2 + 1] = y;
  return next;
}

/** Arrow keys move a handle by 0.01, or 0.1 with Shift; other keys return null. */
export function nudgeHandle(
  points: CubicPoints,
  handle: HandleIndex,
  key: string,
  coarse: boolean
): CubicPoints | null {
  const direction = NUDGES[key];
  if (!direction) return null;
  const step = coarse ? 0.1 : 0.01;
  const target = {
    x: points[handle * 2] + direction.x * step,
    y: points[handle * 2 + 1] + direction.y * step,
  };
  return moveHandle(points, handle, target, false);
}

export function curvePath([x1, y1, x2, y2]: CubicPoints): string {
  const start = toPlot(0, 0);
  const first = toPlot(x1, y1);
  const second = toPlot(x2, y2);
  const end = toPlot(1, 1);
  return `M ${start.x} ${start.y} C ${first.x} ${first.y} ${second.x} ${second.y} ${end.x} ${end.y}`;
}

export function holdPath(): string {
  const start = toPlot(0, 0);
  const corner = toPlot(1, 0);
  const end = toPlot(1, 1);
  return `M ${start.x} ${start.y} L ${corner.x} ${corner.y} L ${end.x} ${end.y}`;
}

/** Where a handle draws: on the plot, pinned to its edge when it lies beyond the visible range. */
export function handleOnPlot(x: number, y: number): PlotPoint & { offScale: boolean } {
  const visible = clamp(y, PLOT_Y_MIN, PLOT_Y_MAX);
  return { ...toPlot(x, visible), offScale: visible !== y };
}
