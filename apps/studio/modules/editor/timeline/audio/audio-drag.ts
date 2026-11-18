import {
  ensureAudioTrack,
  findAudioClip,
  moveAudioClips,
  moveVolumeKeyframes,
  setAudioFade,
  setVolumeAt,
  trimAudioClip,
  updateAudioClip,
} from "@calcom/product-video/audio/audio-edits";
import type { Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { snapSpanStart, snapTime } from "../timeline-snapping";

export type AudioDragMode =
  | "move"
  | "trim-start"
  | "trim-end"
  | "fade-in"
  | "fade-out"
  | "volume"
  | "keyframes";

export type AudioDrag = {
  mode: AudioDragMode;
  /** The clip under the pointer; snapping follows its edges. */
  clipId: string;
  /** Everything that moves with it in `move` mode; keyframe ids in `keyframes` mode. */
  ids: readonly string[];
  /** Pointer travel since the drag began. */
  seconds: number;
  /** Vertical travel as a fraction of the clip's height, down positive. */
  heightFraction: number;
  trackDelta: number;
  /** Name for the track a move onto the new-track row adds. */
  newTrackName: string;
  snap: { targets: number[]; thresholdSeconds: number; free: boolean };
  /** Keyframes move in whole frames. */
  frameSeconds: number;
};

/** The project as it looks part-way through a drag, always computed from the project at its start. */
export function applyAudioDrag(base: Project, drag: AudioDrag): Project {
  const found = findAudioClip(base, drag.clipId);
  if (!found) return base;
  const { clip } = found;
  const clipEnd = clip.start + clip.duration;
  const edit = (update: Parameters<typeof updateAudioClip>[2]) => updateAudioClip(base, clip.id, update);
  switch (drag.mode) {
    case "move": {
      const start = snapSpanStart(clip.start + drag.seconds, clip.duration, drag.snap);
      const room = ensureAudioTrack(base, found.trackIndex + drag.trackDelta, drag.newTrackName);
      return moveAudioClips(room, drag.ids, start - clip.start, drag.trackDelta);
    }
    case "trim-start":
      return edit((current) =>
        trimAudioClip(current, "start", snapTime(clip.start + drag.seconds, drag.snap))
      );
    case "trim-end":
      return edit((current) => trimAudioClip(current, "end", snapTime(clipEnd + drag.seconds, drag.snap)));
    case "fade-in":
      return edit((current) => setAudioFade(current, "in", clip.fadeIn + drag.seconds));
    case "fade-out":
      return edit((current) => setAudioFade(current, "out", clip.fadeOut - drag.seconds));
    case "volume":
      if (clip.volume.keyframes.length > 0) return base;
      return edit((current) =>
        setVolumeAt(current, 0, Math.round((clip.volume.value - drag.heightFraction) * 100) / 100)
      );
    case "keyframes": {
      const frames = Math.round(drag.seconds / drag.frameSeconds) * drag.frameSeconds;
      return edit((current) => moveVolumeKeyframes(current, drag.ids, frames));
    }
  }
}
