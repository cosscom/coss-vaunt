const HOLD_MS = 900;
const GAP_MS = 350;

/**
 * Where a looping preview is: the phrase plays as a clip (enter, hold, exit) followed by an empty gap.
 * Returns null during the gap.
 */
export function previewLoopTime(
  elapsedMs: number,
  totals: { enterMs: number; exitMs: number }
): { localTime: number; clipDuration: number } | null {
  const clipMs = totals.enterMs + HOLD_MS + totals.exitMs;
  const local = elapsedMs % (clipMs + GAP_MS);
  if (local >= clipMs) return null;
  return { localTime: local / 1000, clipDuration: clipMs / 1000 };
}
