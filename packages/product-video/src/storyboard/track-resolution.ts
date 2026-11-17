import type { Clip, Project, TransitionKind, VideoTrack } from "./storyboard-schema";

/** A clip visible at a moment, with its local time and its weight in any transition it is part of. */
export type ActiveClip = {
  clip: Clip;
  trackIndex: number;
  /** Seconds since the clip started. */
  localTime: number;
  /** 1 outside transitions; during an overlap the outgoing clip falls 1 → 0 and the incoming rises 0 → 1. */
  presence: number;
  /** Set while this clip is part of an overlap: the incoming clip's transition and its progress (0 → 1). */
  transition: { kind: TransitionKind; progress: number; role: "outgoing" | "incoming" } | null;
};

export function clipEnd(clip: Pick<Clip, "start" | "duration">): number {
  return clip.start + clip.duration;
}

export function projectDuration(project: Pick<Project, "videoTracks" | "audioTracks">): number {
  const ends = [
    ...project.videoTracks.flatMap((track) => track.clips.map(clipEnd)),
    ...project.audioTracks.flatMap((track) => track.clips.map(clipEnd)),
  ];
  return ends.length === 0 ? 0 : Math.max(...ends);
}

function activeClipsOnTrack(track: VideoTrack, trackIndex: number, time: number): ActiveClip[] {
  const clips = [...track.clips].sort((a, b) => a.start - b.start);
  const visible = clips.filter((clip) => time >= clip.start && time < clipEnd(clip));
  return visible.map((clip) => {
    const localTime = time - clip.start;
    const previous = clips[clips.indexOf(clip) - 1];
    const next = clips[clips.indexOf(clip) + 1];
    if (previous && clipEnd(previous) > clip.start && time < clipEnd(previous)) {
      const progress = (time - clip.start) / (clipEnd(previous) - clip.start);
      return {
        clip,
        trackIndex,
        localTime,
        presence: progress,
        transition: { kind: clip.transitionIn, progress, role: "incoming" },
      };
    }
    if (next && clipEnd(clip) > next.start && time >= next.start) {
      const progress = (time - next.start) / (clipEnd(clip) - next.start);
      return {
        clip,
        trackIndex,
        localTime,
        presence: 1 - progress,
        transition: { kind: next.transitionIn, progress, role: "outgoing" },
      };
    }
    return { clip, trackIndex, localTime, presence: 1, transition: null };
  });
}

/**
 * Every clip visible at `time`, bottom track first; within a track the outgoing clip comes first.
 * Hidden tracks are skipped.
 */
export function activeClipsAt(project: Pick<Project, "videoTracks">, time: number): ActiveClip[] {
  return project.videoTracks.flatMap((track, trackIndex) =>
    track.hidden ? [] : activeClipsOnTrack(track, trackIndex, time)
  );
}
