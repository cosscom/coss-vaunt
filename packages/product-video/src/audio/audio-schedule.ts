import type { AudioClip, AudioTrack } from "../storyboard/storyboard-schema";

/** One buffer source to start: at project time `at`, `offset` seconds into its file, for `duration`. */
export type AudioSegment = { clip: AudioClip; at: number; offset: number; duration: number };

const EPSILON = 1e-4;

/**
 * Clips on unmuted tracks that sound somewhere in [from, until) and aren't in `scheduled` yet. A clip
 * already under way at `from` starts mid-file, so a seek lands on the right sample.
 */
export function audioSegmentsBetween(
  tracks: readonly AudioTrack[],
  from: number,
  until: number,
  scheduled: ReadonlySet<string> = new Set()
): AudioSegment[] {
  return tracks
    .filter((track) => !track.muted)
    .flatMap((track) => track.clips)
    .filter((clip) => !scheduled.has(clip.id))
    .filter((clip) => clip.start < until && clip.start + clip.duration > from + EPSILON)
    .map((clip) => {
      const at = Math.max(from, clip.start);
      return {
        clip,
        at,
        offset: clip.trimStart + (at - clip.start),
        duration: clip.start + clip.duration - at,
      };
    })
    .sort((a, b) => a.at - b.at);
}

/** Maps project time onto the audio context's clock from one moment both were read at. */
export function contextTimeAt(anchor: { context: number; project: number }, projectTime: number): number {
  return anchor.context + (projectTime - anchor.project);
}

/** The inverse of `contextTimeAt`: where the project is when the audio context reads `contextTime`. */
export function projectTimeAt(anchor: { context: number; project: number }, contextTime: number): number {
  return anchor.project + (contextTime - anchor.context);
}

export type VoiceTiming = {
  /** Audio-context time to start at. */
  when: number;
  /** Seconds into the file. */
  offset: number;
  duration: number;
  /** Seconds into the clip where the sound starts, for its gain curve. */
  fromLocal: number;
};

/**
 * When and where in its file a segment's source starts. A segment already due (scheduled late, or
 * mid-clip after a seek) starts now, that much further into the file; null once nothing is left.
 */
export function voiceTiming(
  segment: AudioSegment,
  anchor: { context: number; project: number },
  contextNow: number,
  bufferDuration: number
): VoiceTiming | null {
  const due = contextTimeAt(anchor, segment.at);
  const late = Math.max(0, contextNow - due);
  const offset = segment.offset + late;
  const duration = Math.min(segment.duration - late, bufferDuration - offset);
  if (duration <= 1e-3) return null;
  return { when: due + late, offset, duration, fromLocal: segment.at + late - segment.clip.start };
}
