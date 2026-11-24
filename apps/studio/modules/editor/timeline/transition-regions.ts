import type { TransitionKind, VideoTrack } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { clipEnd } from "@coss/vaunt-engine/storyboard/track-resolution";

/** An overlap on a track, owned by its incoming clip. */
export type TransitionRegion = {
  clipId: string;
  outgoingClipId: string;
  start: number;
  end: number;
  kind: TransitionKind;
};

export function transitionRegions(track: Pick<VideoTrack, "clips">): TransitionRegion[] {
  const clips = [...track.clips].sort((a, b) => a.start - b.start);
  return clips.flatMap((clip, index) => {
    const previous = clips[index - 1];
    if (!previous || clipEnd(previous) <= clip.start) return [];
    return [
      {
        clipId: clip.id,
        outgoingClipId: previous.id,
        start: clip.start,
        end: clipEnd(previous),
        kind: clip.transitionIn,
      },
    ];
  });
}
