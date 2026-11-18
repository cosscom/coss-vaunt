import type { PropertyValues } from "../storyboard/property-evaluation";
import type { Clip } from "../storyboard/storyboard-schema";
import type { Size } from "./camera-rig";
import type { CursorTrack } from "./cursor-track";

/** A recording's cursor path and the viewport its CSS px are measured in. */
export type CursorSource = { track: CursorTrack; viewport: Size };

/** The close-up glides after the cursor over this many seconds, so it eases rather than snapping to every move. */
export const CLOSE_UP_FOLLOW_SECONDS = 1.2;
/** Blur follows more tightly: the sharp spot should stay on the pointer. */
export const BLUR_FOLLOW_SECONDS = 0.3;

/**
 * The cursor on the device in device fractions (−1..1, y down), averaged over `window` seconds centred on
 * `time` with weights falling off towards the edges: a pure function of time, so scrubbing and export agree.
 * Null when the cursor is hidden throughout the window.
 */
export function cursorFocusAt(
  { track, viewport }: CursorSource,
  time: number,
  window: number
): { x: number; y: number } | null {
  const { samples, fps } = track;
  const half = window / 2;
  const first = Math.max(0, Math.floor((time - half) * fps));
  const last = Math.min(samples.length - 1, Math.ceil((time + half) * fps));
  let [x, y, total] = [0, 0, 0];
  for (let frame = first; frame <= last; frame++) {
    const sample = samples[frame];
    if (!sample?.visible) continue;
    const weight = half > 0 ? Math.max(0, 1 - Math.abs(frame / fps - time) / half) : 1;
    if (weight === 0) continue;
    x += sample.x * weight;
    y += sample.y * weight;
    total += weight;
  }
  if (total === 0) return null;
  const clamp = (value: number) => Math.min(1, Math.max(-1, value));
  return { x: clamp((x / total / viewport.width) * 2 - 1), y: clamp((y / total / viewport.height) * 2 - 1) };
}

/** The clip's values with the blur's focus point on the cursor, when its blur follows it and the cursor shows. */
export function withBlurOnCursor(
  clip: Pick<Clip, "blur">,
  values: PropertyValues,
  localTime: number,
  cursor: CursorSource | null | undefined
): PropertyValues {
  if (!clip.blur?.followCursor || !cursor) return values;
  const focus = cursorFocusAt(cursor, localTime, BLUR_FOLLOW_SECONDS);
  return focus ? { ...values, focusX: focus.x, focusY: focus.y } : values;
}
