export const AUTOSCROLL_EDGE_PX = 48;
export const AUTOSCROLL_MAX_PX_PER_FRAME = 24;

/**
 * Pixels to scroll the timeline this frame while a drag nears a visible edge: it speeds up the deeper
 * the pointer is in the edge zone and runs at full speed past the edge.
 */
export function autoscrollStep(pointerX: number, visibleStart: number, visibleEnd: number): number {
  const intoStart = visibleStart + AUTOSCROLL_EDGE_PX - pointerX;
  if (intoStart > 0) return -speed(intoStart);
  const intoEnd = pointerX - (visibleEnd - AUTOSCROLL_EDGE_PX);
  if (intoEnd > 0) return speed(intoEnd);
  return 0;
}

function speed(depth: number): number {
  return AUTOSCROLL_MAX_PX_PER_FRAME * Math.min(1, depth / AUTOSCROLL_EDGE_PX) ** 2;
}
