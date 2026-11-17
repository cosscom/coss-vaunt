/** The part of an element `width` px wide, starting at `left` px in viewport space, that a viewport [from, to) shows. */
export function visibleSpan(
  left: number,
  width: number,
  viewFrom: number,
  viewTo: number
): [number, number] | null {
  const from = Math.max(0, Math.floor(viewFrom - left));
  const to = Math.min(width, Math.ceil(viewTo - left));
  return to > from ? [from, to] : null;
}
