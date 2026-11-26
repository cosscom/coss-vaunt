import type { Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";

type LockableTrack = { id: string; locked?: boolean; clips: readonly { id: string }[] };

/** Clips on locked video and audio tracks: they can't be picked, selected or edited in the editor. */
export function lockedClipIds(project: Project): ReadonlySet<string> {
  const tracks: LockableTrack[] = [...project.videoTracks, ...project.audioTracks];
  return new Set(tracks.flatMap((track) => (track.locked ? track.clips.map((clip) => clip.id) : [])));
}

export function withoutLockedClips(clipIds: readonly string[], project: Project): string[] {
  const locked = lockedClipIds(project);
  return locked.size === 0 ? [...clipIds] : clipIds.filter((id) => !locked.has(id));
}

function changesClips(before: readonly LockableTrack[], after: readonly LockableTrack[]): boolean {
  const next = new Map(after.map((track) => [track.id, track]));
  return before.some((track) => {
    const later = next.get(track.id);
    if (!track.locked || !later?.locked || later.clips === track.clips) return false;
    return JSON.stringify(later.clips) !== JSON.stringify(track.clips);
  });
}

/**
 * True when `after` changes the clips of a track that is locked in both projects: an edit, a move out of
 * it or a drop onto it. Locking, unlocking and removing a locked track stay allowed.
 */
export function changesLockedTracks(before: Project, after: Project): boolean {
  if (before === after) return false;
  return (
    changesClips(before.videoTracks, after.videoTracks) || changesClips(before.audioTracks, after.audioTracks)
  );
}

/** Where a clip dragged over `candidate` lands: a locked track refuses it, so it stays on `fallback`. */
export function dropTrackIndex(
  tracks: readonly { locked?: boolean }[],
  candidate: number,
  fallback: number
): number {
  return tracks[candidate]?.locked ? fallback : candidate;
}

/** Pointer gestures on a locked clip don't start: no select, drag or trim. */
export function isClipLocked(project: Project, clipId: string): boolean {
  return lockedClipIds(project).has(clipId);
}
