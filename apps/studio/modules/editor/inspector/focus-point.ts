import type { Drift } from "@coss/vaunt-engine/storyboard/storyboard-schema";

type Focus = Drift["focus"];
type Box = { left: number; top: number; width: number; height: number };

const clamp = (value: number) => Math.min(1, Math.max(-1, value));
const round = (value: number) => Math.round(value * 1000) / 1000;

/** The point under the pointer as fractions of the media's half-size (y down), clamped to the media. */
export function focusFromPointer(box: Box, clientX: number, clientY: number): Focus {
  return {
    x: round(clamp(((clientX - box.left) / box.width) * 2 - 1)),
    y: round(clamp(((clientY - box.top) / box.height) * 2 - 1)),
  };
}

const NUDGES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Arrow keys move the focus a step (a bigger one with Shift); other keys return null. */
export function nudgeFocus(focus: Focus, key: string, big: boolean): Focus | null {
  const nudge = NUDGES[key];
  if (!nudge) return null;
  const step = big ? 0.2 : 0.05;
  return { x: round(clamp(focus.x + nudge[0] * step)), y: round(clamp(focus.y + nudge[1] * step)) };
}

/** Where the focus sits in the picker, as CSS percentages. */
export function focusPercent(focus: Focus): { left: string; top: string } {
  return { left: `${((focus.x + 1) / 2) * 100}%`, top: `${((focus.y + 1) / 2) * 100}%` };
}

/** Matches the stage's slide: the share of the frame the media travels over the clip at full intensity. */
const SLIDE_TRAVEL = 0.3;
const CAMERA_DIRECTIONS: Record<Drift["direction"], [number, number]> = {
  left: [1, 0],
  right: [-1, 0],
  up: [0, 1],
  down: [0, -1],
};

/**
 * The path the close-up's frame takes across the media, in picker percentages: the camera moves against the
 * media's travel, crossing the focus point halfway. Null when it doesn't slide.
 */
export function driftPath(
  drift: Drift
): { from: { x: number; y: number }; to: { x: number; y: number } } | null {
  if (drift.motion !== "slide" && drift.motion !== "slide-tilt") return null;
  if (drift.intensity === 0) return null;
  const [dx, dy] = CAMERA_DIRECTIONS[drift.direction];
  const half = (100 * SLIDE_TRAVEL * drift.intensity) / drift.zoom / 2;
  const x = ((drift.focus.x + 1) / 2) * 100;
  const y = ((drift.focus.y + 1) / 2) * 100;
  return { from: { x: x - dx * half, y: y - dy * half }, to: { x: x + dx * half, y: y + dy * half } };
}
