const MIN_LABEL_SPACING_PX = 56;

/** Each major step with how many minor ticks divide it. */
const TICK_STEPS: [number, number][] = [
  [1, 4],
  [2, 4],
  [5, 5],
  [10, 5],
  [15, 3],
  [30, 3],
];

export const TIMELINE_ZOOM_LEVELS = [10, 16, 24, 36, 54, 80, 120, 180, 270, 400, 600, 800] as const;
export const MIN_PX_PER_SECOND = TIMELINE_ZOOM_LEVELS[0];
export const MAX_PX_PER_SECOND = TIMELINE_ZOOM_LEVELS[TIMELINE_ZOOM_LEVELS.length - 1];
export const DEFAULT_PX_PER_SECOND = 54;

export type RulerTick = { seconds: number; major: boolean };

export function secondsToPx(seconds: number, pxPerSecond: number): number {
  return seconds * pxPerSecond;
}

export function pxToSeconds(px: number, pxPerSecond: number, maxSeconds = Number.POSITIVE_INFINITY): number {
  return Math.min(maxSeconds, Math.max(0, px / pxPerSecond));
}

export function rulerTicks(totalSeconds: number, pxPerSecond: number): RulerTick[] {
  const [major, divisions] =
    TICK_STEPS.find(([step]) => step * pxPerSecond >= MIN_LABEL_SPACING_PX) ??
    TICK_STEPS[TICK_STEPS.length - 1];
  const minor = major / divisions;
  const count = Math.floor(totalSeconds / minor + 1e-9);
  return Array.from({ length: count + 1 }, (_, index) => {
    const seconds = Number((index * minor).toFixed(4));
    return { seconds, major: index % divisions === 0 };
  });
}

export function zoomTimeline(pxPerSecond: number, direction: "in" | "out"): number {
  const index = TIMELINE_ZOOM_LEVELS.findIndex((level) => level >= pxPerSecond);
  const current = index === -1 ? TIMELINE_ZOOM_LEVELS.length - 1 : index;
  const next = direction === "in" ? current + 1 : current - 1;
  return TIMELINE_ZOOM_LEVELS[Math.min(TIMELINE_ZOOM_LEVELS.length - 1, Math.max(0, next))];
}

export function clampPxPerSecond(pxPerSecond: number): number {
  return Math.min(MAX_PX_PER_SECOND, Math.max(MIN_PX_PER_SECOND, pxPerSecond));
}

/** Pinch and ⌘-wheel deltas to a zoom factor; a full notch (100) is about ×1.3. */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * 0.0025);
}

/**
 * Zooms by `factor` keeping the time under the pointer where it is. `pointerX` is the pointer's offset
 * into the scrolled content, `padding` the content's leading padding.
 */
export function zoomAroundPointer({
  pxPerSecond,
  scrollLeft,
  pointerX,
  padding,
  factor,
}: {
  pxPerSecond: number;
  scrollLeft: number;
  pointerX: number;
  padding: number;
  factor: number;
}): { pxPerSecond: number; scrollLeft: number } {
  const next = clampPxPerSecond(pxPerSecond * factor);
  const time = (pointerX - padding) / pxPerSecond;
  return { pxPerSecond: next, scrollLeft: Math.max(0, scrollLeft + time * (next - pxPerSecond)) };
}

/** The scale that shows `duration` seconds in `width` pixels. */
export function fitPxPerSecond(duration: number, width: number): number {
  if (duration <= 0 || width <= 0) return DEFAULT_PX_PER_SECOND;
  return clampPxPerSecond(width / duration);
}
