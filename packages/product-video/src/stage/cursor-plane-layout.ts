import type { CursorSettings, CursorStyle } from "../storyboard/storyboard-schema";
import type { CursorFrame } from "./cursor-track";

const RIPPLE_START_RADIUS = 6;
const RIPPLE_END_RADIUS = 30;
const RIPPLE_PEAK_OPACITY = 0.45;
const RIPPLE_LINE = 2;

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * Each style is drawn on a square texture; `hotspot` is the point that sits on the sample, in texture UV
 * with y down, and `side` is the square's size in page pixels at cursor size 1.
 */
export const CURSOR_SHAPES: Record<CursorStyle, { hotspot: { u: number; v: number }; side: number }> = {
  arrow: { hotspot: { u: 0.25, v: 0.1875 }, side: 40 },
  dot: { hotspot: { u: 0.5, v: 0.5 }, side: 32 },
};

export const PRESSED_SCALE = 0.85;

/** A square on the device plane: centre in plane units (−0.5…0.5, y up) and side as a fraction of each axis. */
export type PlaneQuad = { x: number; y: number; width: number; height: number };

export type CursorPlaneLayout = {
  sprite: PlaneQuad;
  /** `thickness` is the ring's line width as a fraction of its radius. */
  ripple: (PlaneQuad & { opacity: number; thickness: number }) | null;
};

/** Where the cursor and its click ripple sit on the device plane of a `viewport`-sized recording. */
export function cursorPlaneLayout(
  frame: CursorFrame,
  settings: Pick<CursorSettings, "size" | "style">,
  viewport: { width: number; height: number }
): CursorPlaneLayout {
  const toPlane = (x: number, y: number) => ({ x: x / viewport.width - 0.5, y: 0.5 - y / viewport.height });
  const shape = CURSOR_SHAPES[settings.style];
  const side = shape.side * settings.size * (1 - (1 - PRESSED_SCALE) * frame.press);
  const tip = toPlane(frame.x, frame.y);
  const sprite = {
    x: tip.x + ((0.5 - shape.hotspot.u) * side) / viewport.width,
    y: tip.y - ((0.5 - shape.hotspot.v) * side) / viewport.height,
    width: side / viewport.width,
    height: side / viewport.height,
  };
  if (!frame.ripple) return { sprite, ripple: null };

  const { progress } = frame.ripple;
  const radius =
    settings.size * (RIPPLE_START_RADIUS + (RIPPLE_END_RADIUS - RIPPLE_START_RADIUS) * easeOut(progress));
  const centre = toPlane(frame.ripple.x, frame.ripple.y);
  return {
    sprite,
    ripple: {
      ...centre,
      width: (2 * radius) / viewport.width,
      height: (2 * radius) / viewport.height,
      opacity: RIPPLE_PEAK_OPACITY * (1 - progress) ** 2,
      thickness: (RIPPLE_LINE * settings.size) / radius,
    },
  };
}
