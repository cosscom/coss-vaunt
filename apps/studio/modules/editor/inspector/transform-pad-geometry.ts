import { PROPERTY_SPECS } from "@calcom/product-video/storyboard/property-specs";

export type Point = { x: number; y: number };
/** The output frame drawn in the pad, in pad units. */
export type PadFrame = { left: number; top: number; width: number; height: number };
export type Transform = { x: number; y: number; scale: number };
export type TransformKey = keyof Transform;

/** Pad units around the frame, so a clip moved or scaled past the edge still shows. */
export const PAD_MARGIN = 14;
/** The frame's longer side in pad units. */
const FRAME_SIZE = 148;
/** How close to a corner a press grabs it to scale. */
const CORNER_REACH = 9;

function fit(key: TransformKey, value: number): number {
  const spec = PROPERTY_SPECS[key];
  const stepped = Math.round(value / spec.step) * spec.step;
  return Number(Math.min(spec.max, Math.max(spec.min, stepped)).toFixed(4));
}

/** The frame for an output `aspect` (width over height), its longer side `FRAME_SIZE`, inside the margin. */
export function padFrame(aspect: number): PadFrame {
  const width = aspect >= 1 ? FRAME_SIZE : FRAME_SIZE * aspect;
  const height = aspect >= 1 ? FRAME_SIZE / aspect : FRAME_SIZE;
  return { left: PAD_MARGIN, top: PAD_MARGIN, width, height };
}

/**
 * Where the clip sits in the frame: it fills it at scale 1, scales about the frame's centre, and moves by
 * Position X/Y in fractions of the frame (y down), as the stage places it.
 */
export function clipRect(frame: PadFrame, { x, y, scale }: Transform) {
  const width = frame.width * scale;
  const height = frame.height * scale;
  const cx = frame.left + frame.width / 2 + x * frame.width;
  const cy = frame.top + frame.height / 2 + y * frame.height;
  return {
    centre: { x: cx, y: cy },
    left: cx - width / 2,
    top: cy - height / 2,
    width,
    height,
    corners: [
      { x: cx - width / 2, y: cy - height / 2 },
      { x: cx + width / 2, y: cy - height / 2 },
      { x: cx + width / 2, y: cy + height / 2 },
      { x: cx - width / 2, y: cy + height / 2 },
    ],
  };
}

export type PadZone = "scale" | "move";

/** A press near one of the clip's corners scales it; anywhere else moves it. */
export function padZone(frame: PadFrame, transform: Transform, point: Point): PadZone {
  const near = clipRect(frame, transform).corners.some(
    (corner) => Math.hypot(corner.x - point.x, corner.y - point.y) <= CORNER_REACH
  );
  return near ? "scale" : "move";
}

/** A move drag of `delta` pad units from `start`; `lockAxis` keeps only the larger of the two moves. */
export function dragPosition(
  frame: PadFrame,
  start: Transform,
  delta: Point,
  lockAxis: boolean
): Pick<Transform, "x" | "y"> {
  const horizontal = Math.abs(delta.x) >= Math.abs(delta.y);
  const dx = lockAxis && !horizontal ? 0 : delta.x;
  const dy = lockAxis && horizontal ? 0 : delta.y;
  return { x: fit("x", start.x + dx / frame.width), y: fit("y", start.y + dy / frame.height) };
}

/**
 * A corner drag from `press` to `point`: the clip scales about its centre by how much further from it the
 * pointer is than where it grabbed, so taking hold never jumps.
 */
export function dragScale(frame: PadFrame, start: Transform, press: Point, point: Point): number {
  const { centre } = clipRect(frame, start);
  const reach = (at: Point) =>
    Math.max(Math.abs(at.x - centre.x) / (frame.width / 2), Math.abs(at.y - centre.y) / (frame.height / 2));
  const from = reach(press);
  return from < 1e-6 ? start.scale : fit("scale", (start.scale * reach(point)) / from);
}

/** Arrow keys move by a step (Shift ten), [ and ] scale; null for any other key. */
export function transformNudge(
  code: string,
  shift: boolean,
  transform: Transform
): { key: TransformKey; value: number } | null {
  const step = shift ? 10 : 1;
  const move = (key: TransformKey, sign: number) => ({
    key,
    value: fit(key, transform[key] + sign * step * PROPERTY_SPECS[key].step),
  });
  switch (code) {
    case "ArrowLeft":
      return move("x", -1);
    case "ArrowRight":
      return move("x", 1);
    case "ArrowUp":
      return move("y", -1);
    case "ArrowDown":
      return move("y", 1);
    case "BracketLeft":
      return move("scale", -1);
    case "BracketRight":
      return move("scale", 1);
    default:
      return null;
  }
}
