/** The frame a looping preview at `fps` shows `elapsedMs` after it started. */
export function loopedFrame(elapsedMs: number, fps: number, frameCount: number): number {
  if (frameCount <= 0) return 0;
  return Math.floor((Math.max(0, elapsedMs) / 1000) * fps) % frameCount;
}
