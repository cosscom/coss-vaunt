/**
 * Where a resize gap's glow may light: only the stretches of the gap's edge that a bordered card actually sits
 * against, stopping short of each card's rounded corners. A gap above the timeline runs past several cards and the
 * gaps between them, and only the cards' borders should light.
 */

export type Rect = { left: number; top: number; right: number; bottom: number };
export type Segment = { start: number; end: number };

/** Cards are rounded-xl; the glow ends this far from a corner and fades in over `FADE_PX`. */
export const CORNER_PX = 14;
export const FADE_PX = 28;
/** How close a card's edge must be to the gap's to count as against it, for subpixel layouts. */
const TOUCH_PX = 1.5;

/**
 * The segments, along the gap, of every card whose edge lies against the gap's `side` ("before" is left of a
 * vertical gap or above a horizontal one). Segments too short to clear both corners are dropped.
 */
export function cardSegments(
  gap: Rect,
  cards: readonly Rect[],
  vertical: boolean,
  side: "before" | "after"
): Segment[] {
  const segments: Segment[] = [];
  for (const card of cards) {
    let touches: boolean;
    if (vertical)
      touches = Math.abs(side === "before" ? card.right - gap.left : card.left - gap.right) <= TOUCH_PX;
    else touches = Math.abs(side === "before" ? card.bottom - gap.top : card.top - gap.bottom) <= TOUCH_PX;
    if (!touches) continue;
    const start = vertical ? Math.max(card.top, gap.top) - gap.top : Math.max(card.left, gap.left) - gap.left;
    const end = vertical
      ? Math.min(card.bottom, gap.bottom) - gap.top
      : Math.min(card.right, gap.right) - gap.left;
    if (end - start > CORNER_PX * 2) segments.push({ start, end });
  }
  return segments.sort((a, b) => a.start - b.start);
}

/** A mask that keeps paint on the segments only, fading in after each corner and out before the next. */
export function segmentMask(segments: readonly Segment[], vertical: boolean): string {
  if (segments.length === 0) return "linear-gradient(transparent, transparent)";
  const stops = segments.flatMap(({ start, end }) => {
    const fade = Math.min(FADE_PX, (end - start) / 2 - CORNER_PX);
    return [
      `transparent ${start + CORNER_PX}px`,
      `#000 ${start + CORNER_PX + fade}px`,
      `#000 ${end - CORNER_PX - fade}px`,
      `transparent ${end - CORNER_PX}px`,
    ];
  });
  return `linear-gradient(${vertical ? "to bottom" : "to right"}, transparent 0px, ${stops.join(", ")}, transparent 100%)`;
}
