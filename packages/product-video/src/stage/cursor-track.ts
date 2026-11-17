import type { CursorSample } from "../recording/recording-manifest";

type Press = { start: number; end: number; x: number; y: number };

function easeInOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/** How long the arrow takes to sink into, and spring back from, a press. */
export const PRESS_RAMP_SECONDS = 0.06;
export const RIPPLE_SECONDS = 0.5;

/** The recorder's per-frame samples, ready to evaluate at any clip time. */
export type CursorTrack = { samples: readonly CursorSample[]; fps: number; presses: Press[] };

/** Page pixels of the recording viewport, like the samples. */
export type CursorFrame = {
  x: number;
  y: number;
  /** 0 at rest, 1 fully pressed, eased between. */
  press: number;
  ripple: { x: number; y: number; progress: number } | null;
};

/** Null when the recording has no cursor to draw, e.g. it was made before the recorder logged one. */
export function createCursorTrack(
  samples: readonly CursorSample[] | undefined,
  fps: number
): CursorTrack | null {
  if (!samples?.some((sample) => sample.visible)) return null;
  const presses: Press[] = [];
  for (let frame = 0; frame < samples.length; frame++) {
    if (!samples[frame].pressed || samples[frame - 1]?.pressed) continue;
    let end = frame;
    while (end < samples.length && samples[end].pressed) end++;
    presses.push({ start: frame / fps, end: end / fps, x: samples[frame].x, y: samples[frame].y });
  }
  return { samples, fps, presses };
}

/**
 * The samples are already the recorder's eased, arced path (see `cursor-path.ts`), and the page's hover and
 * press states happened at exactly those points, so they are only interpolated between frames, never re-smoothed.
 */
export function cursorFrameAt(track: CursorTrack, time: number): CursorFrame | null {
  const { samples, fps, presses } = track;
  const position = Math.min(samples.length - 1, Math.max(0, time * fps));
  const index = Math.floor(position);
  const from = samples[index];
  const nearest = samples[Math.round(position)];
  if (!nearest.visible) return null;
  const to = samples[Math.min(samples.length - 1, index + 1)];
  const fraction = position - index;

  let press = 0;
  let ripple: CursorFrame["ripple"] = null;
  for (const { start, end, x, y } of presses) {
    if (time < start) break;
    const rise = easeInOut((time - start) / PRESS_RAMP_SECONDS);
    const fall = time < end ? 1 : 1 - easeInOut((time - end) / PRESS_RAMP_SECONDS);
    press = Math.max(press, Math.min(rise, fall));
    const progress = (time - start) / RIPPLE_SECONDS;
    if (progress < 1) ripple = { x, y, progress };
  }

  return {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
    press,
    ripple,
  };
}
