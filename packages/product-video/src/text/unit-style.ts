import type { TextFrame } from "../catalogues/text-effects/text-effect-schema";

/** Inline style for one unit; `none` at rest so idle text keeps no transform or filter. */
export type UnitStyle = { opacity: number; transform: string; filter: string };

export const REST_STYLE: UnitStyle = { opacity: 1, transform: "none", filter: "none" };

export type FrameValues = Required<TextFrame>;

const REST_FRAME: FrameValues = {
  opacity: 1,
  x_px: 0,
  y_px: 0,
  z_px: 0,
  scale: 1,
  rotate_deg: 0,
  rotate_x_deg: 0,
  rotate_y_deg: 0,
  blur_px: 0,
};

const FRAME_KEYS = Object.keys(REST_FRAME) as (keyof FrameValues)[];

/** Not clamped, so an overshooting easing overshoots scale and travel as the showcase does. */
export function mixFrames(from: TextFrame, to: TextFrame, progress: number): FrameValues {
  const frame = { ...REST_FRAME };
  for (const key of FRAME_KEYS) {
    const start = from[key] ?? REST_FRAME[key];
    const end = to[key] ?? REST_FRAME[key];
    frame[key] = start + (end - start) * progress;
  }
  return frame;
}

const round = (value: number): number => Math.round(value * 1000) / 1000;
const isZero = (value: number): boolean => Math.abs(value) < 0.0005;

function blurFilter(blurPx: number): string {
  return blurPx > 0.0005 ? `blur(${round(blurPx)}px)` : "none";
}

const clampOpacity = (value: number): number => round(Math.min(1, Math.max(0, value)));

/**
 * The showcase's frame materialisation: `translate3d(x, y × yTravel, z) rotateX rotateY rotate scale`, with
 * pixel values scaled from showcase pixels to the frame and identity parts left out.
 */
export function frameStyle(frame: FrameValues, pxScale: number, yTravelMultiplier: number): UnitStyle {
  const x = frame.x_px * pxScale;
  const y = frame.y_px * yTravelMultiplier * pxScale;
  const z = frame.z_px * pxScale;
  const parts: string[] = [];
  if (!isZero(x) || !isZero(y) || !isZero(z))
    parts.push(`translate3d(${round(x)}px, ${round(y)}px, ${round(z)}px)`);
  if (!isZero(frame.rotate_x_deg)) parts.push(`rotateX(${round(frame.rotate_x_deg)}deg)`);
  if (!isZero(frame.rotate_y_deg)) parts.push(`rotateY(${round(frame.rotate_y_deg)}deg)`);
  if (!isZero(frame.rotate_deg)) parts.push(`rotate(${round(frame.rotate_deg)}deg)`);
  if (!isZero(frame.scale - 1)) parts.push(`scale(${round(frame.scale)})`);
  return {
    opacity: clampOpacity(frame.opacity),
    transform: parts.length === 0 ? "none" : parts.join(" "),
    filter: blurFilter(frame.blur_px * pxScale),
  };
}

/** Frame pixels. Kinetic words are absolutely centred, so their transform always carries the centring translate. */
export function kineticWordStyle(pose: {
  x: number;
  y: number;
  scale: number;
  blur: number;
  opacity: number;
}): UnitStyle {
  const scale = isZero(pose.scale - 1) ? "" : ` scale(${round(pose.scale)})`;
  return {
    opacity: clampOpacity(pose.opacity),
    transform: `translate(-50%, -50%) translate3d(${round(pose.x)}px, ${round(pose.y)}px, 0px)${scale}`,
    filter: blurFilter(pose.blur),
  };
}

/** Piecewise-linear value through `[offset, value]` stops at an eased progress, held outside the stops. */
export function keyframeValue(stops: readonly (readonly [number, number])[], progress: number): number {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (progress <= first[0]) return first[1];
  if (progress >= last[0]) return last[1];
  for (let index = 1; index < stops.length; index++) {
    const [offset, value] = stops[index];
    if (progress > offset) continue;
    const [previousOffset, previousValue] = stops[index - 1];
    const span = offset - previousOffset;
    return span === 0
      ? value
      : previousValue + ((value - previousValue) * (progress - previousOffset)) / span;
  }
  return last[1];
}
