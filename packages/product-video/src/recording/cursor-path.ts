import type { CursorTravel } from "./action-schedule";

export type Point = { x: number; y: number };

/** Bow of the path as a fraction of the distance travelled, so moves read as a hand, not a ruler. */
const ARC_FRACTION = 0.08;
const MAX_ARC_PIXELS = 48;

/** Minimum-jerk profile: zero velocity and acceleration at both ends. */
export function minimumJerk(progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  return t * t * t * (10 - 15 * t + 6 * t * t);
}

/** A point along a gently curved, eased path from `from` to `to`. */
export function travelPoint(from: Point, to: Point, progress: number): Point {
  const t = minimumJerk(progress);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return { ...to };
  const bow = Math.min(MAX_ARC_PIXELS, distance * ARC_FRACTION);
  const control = {
    x: (from.x + to.x) / 2 + (dy / distance) * bow,
    y: (from.y + to.y) / 2 - (dx / distance) * bow,
  };
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  };
}

/**
 * Cursor position on `frame`. `destinations[i]` is where travel i ends (resolved from the page when it starts),
 * and each travel starts where the one before ended, or at `rest`.
 */
export function cursorPointAtFrame({
  frame,
  travels,
  destinations,
  rest,
}: {
  frame: number;
  travels: readonly CursorTravel[];
  destinations: ReadonlyArray<Point | undefined>;
  rest: Point;
}): Point {
  let origin = rest;
  for (let index = 0; index < travels.length; index++) {
    const travel = travels[index];
    if (frame < travel.startFrame) return origin;
    const destination = destinations[index] ?? origin;
    if (frame >= travel.endFrame) {
      origin = destination;
      continue;
    }
    return travelPoint(
      origin,
      destination,
      (frame - travel.startFrame) / (travel.endFrame - travel.startFrame)
    );
  }
  return origin;
}

/** Where the cursor waits before its first move: low and right of centre, clear of most content. */
export function restPoint(viewport: { width: number; height: number }): Point {
  return { x: Math.round(viewport.width * 0.62), y: Math.round(viewport.height * 0.8) };
}
