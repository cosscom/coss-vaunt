import type { Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { clipEnd } from "@coss/vaunt-engine/storyboard/track-resolution";

type SnapOptions = { targets: number[]; thresholdSeconds: number; free: boolean };

export const GRID_SECONDS = 0.1;
export const SNAP_DISTANCE_PX = 8;

export function roundToGrid(time: number): number {
  return Number((Math.round(time / GRID_SECONDS) * GRID_SECONDS).toFixed(3));
}

/** 0, the playhead and every clip edge except the dragged clip's own. */
export function snapTargets(project: Project, playhead: number, excludeClipId: string | null): number[] {
  const edges = project.videoTracks.flatMap((track) =>
    track.clips.filter((clip) => clip.id !== excludeClipId).flatMap((clip) => [clip.start, clipEnd(clip)])
  );
  return [0, playhead, ...edges];
}

/** A target within reach wins, else the grid; `free` (Shift) skips both. */
export function snapTime(time: number, { targets, thresholdSeconds, free }: SnapOptions): number {
  if (free) return Math.max(0, time);
  let best: number | null = null;
  for (const target of targets) {
    const distance = Math.abs(target - time);
    if (distance <= thresholdSeconds && (best === null || distance < Math.abs(best - time))) best = target;
  }
  return Math.max(0, best ?? roundToGrid(time));
}

/** Snaps whichever edge of a moving span lands closer to a target; the grid applies to its start. */
export function snapSpanStart(start: number, duration: number, options: SnapOptions): number {
  if (options.free) return Math.max(0, start);
  const byStart = snapTime(start, { ...options, free: false });
  const byEnd = snapTime(start + duration, { ...options, free: false }) - duration;
  const startHit = options.targets.includes(byStart);
  const endHit = options.targets.includes(byEnd + duration);
  if (startHit && endHit) return Math.abs(byStart - start) <= Math.abs(byEnd - start) ? byStart : byEnd;
  if (endHit) return Math.max(0, byEnd);
  return byStart;
}
