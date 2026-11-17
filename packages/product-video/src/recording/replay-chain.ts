import type { Action, Clip, Project } from "../storyboard/storyboard-schema";

/** A recording the recorder replays, uncaptured, before the clip it leads into. */
export type ReplayStep = { route: string; actions: Action[]; duration: number };

function findRecordingClip(videoTracks: Project["videoTracks"], clipId: string): Clip | null {
  for (const track of videoTracks) {
    const clip = track.clips.find((candidate) => candidate.id === clipId);
    if (clip) return clip;
  }
  return null;
}

/** The clips `clip` continues from, earliest first; empty when it starts fresh. */
export function replayChain(videoTracks: Project["videoTracks"] | undefined, clip: Clip): ReplayStep[] {
  if (clip.source.kind !== "recording" || !clip.source.startFrom) return [];
  if (!videoTracks) throw new Error(`Clip "${clip.name}" starts from another clip, but no tracks were given`);
  const steps: ReplayStep[] = [];
  const seen = new Set([clip.id]);
  let next: string | undefined = clip.source.startFrom.clipId;
  while (next) {
    if (seen.has(next)) throw new Error(`Clip "${clip.name}" starts from a loop of clips`);
    seen.add(next);
    const previous = findRecordingClip(videoTracks, next);
    if (!previous || previous.source.kind !== "recording") {
      throw new Error(`Clip "${clip.name}" starts from ${next}, which is not a recording in this project`);
    }
    steps.unshift({
      route: previous.source.route,
      actions: previous.source.actions,
      duration: previous.duration,
    });
    next = previous.source.startFrom?.clipId;
  }
  return steps;
}
