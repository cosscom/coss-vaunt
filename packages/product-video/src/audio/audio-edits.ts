import { evaluateProperty } from "../storyboard/property-evaluation";
import { keyframeAt, MIN_CLIP_SECONDS } from "../storyboard/storyboard-edits";
import { createAudioTrack } from "../storyboard/storyboard-factories";
import {
  type AudioClip,
  type AudioTrack,
  type Ease,
  type Keyframe,
  MAX_AUDIO_FADE_SECONDS,
  type Project,
} from "../storyboard/storyboard-schema";

export type AudioClipLocation = { clip: AudioClip; trackIndex: number };
export type CopiedVolumeKeyframe = { at: number; value: number; ease: Ease };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clampVolume = (value: number) => clamp(value, 0, 1);
const audioEnd = (clip: Pick<AudioClip, "start" | "duration">) => clip.start + clip.duration;

function newKeyframe(at: number, value: number, ease: Ease = "ease-in-out"): Keyframe {
  return { id: crypto.randomUUID(), at, value, ease };
}

function withKeyframes(clip: AudioClip, keyframes: Keyframe[]): AudioClip {
  return { ...clip, volume: { ...clip.volume, keyframes: [...keyframes].sort((a, b) => a.at - b.at) } };
}

export function findAudioClip(project: Project, clipId: string): AudioClipLocation | null {
  for (const [trackIndex, track] of project.audioTracks.entries()) {
    const clip = track.clips.find((candidate) => candidate.id === clipId);
    if (clip) return { clip, trackIndex };
  }
  return null;
}

export function updateAudioClip(
  project: Project,
  clipId: string,
  update: (clip: AudioClip) => AudioClip
): Project {
  return {
    ...project,
    audioTracks: project.audioTracks.map((track) =>
      track.clips.some((clip) => clip.id === clipId)
        ? { ...track, clips: track.clips.map((clip) => (clip.id === clipId ? update(clip) : clip)) }
        : track
    ),
  };
}

export function updateAudioTrack(
  project: Project,
  trackIndex: number,
  update: (track: AudioTrack) => AudioTrack
): Project {
  if (!project.audioTracks[trackIndex]) return project;
  return {
    ...project,
    audioTracks: project.audioTracks.map((track, index) => (index === trackIndex ? update(track) : track)),
  };
}

export function addAudioTrack(project: Project, name: string): Project {
  return { ...project, audioTracks: [...project.audioTracks, createAudioTrack(name)] };
}

/** Lays `clips` end to end on a track from `start`, e.g. several files dropped at once. */
export function placeAudioClips(
  project: Project,
  trackIndex: number,
  clips: AudioClip[],
  start: number
): Project {
  let cursor = Math.max(0, start);
  const placed = clips.map((clip) => {
    const next = { ...clip, start: cursor };
    cursor = audioEnd(next);
    return next;
  });
  return updateAudioTrack(project, trackIndex, (track) => ({ ...track, clips: [...track.clips, ...placed] }));
}

export function removeAudioClips(project: Project, clipIds: readonly string[]): Project {
  if (clipIds.length === 0) return project;
  const ids = new Set(clipIds);
  return {
    ...project,
    audioTracks: project.audioTracks.map((track) => ({
      ...track,
      clips: track.clips.filter((clip) => !ids.has(clip.id)),
    })),
  };
}

/**
 * Shifts clips by `delta` seconds and `trackDelta` tracks, as one group: the earliest can't go before
 * 0 and none can leave the track list.
 */
export function moveAudioClips(
  project: Project,
  clipIds: readonly string[],
  delta: number,
  trackDelta = 0
): Project {
  const moving = clipIds.map((id) => findAudioClip(project, id)).filter((found) => found !== null);
  if (moving.length === 0) return project;
  const shift = Math.max(delta, -Math.min(...moving.map(({ clip }) => clip.start)));
  const lowest = Math.min(...moving.map(({ trackIndex }) => trackIndex));
  const highest = Math.max(...moving.map(({ trackIndex }) => trackIndex));
  const tracks = clamp(trackDelta, -lowest, project.audioTracks.length - 1 - highest);
  const ids = new Set(moving.map(({ clip }) => clip.id));
  const audioTracks = project.audioTracks.map((track) => ({
    ...track,
    clips: track.clips.filter((clip) => !ids.has(clip.id)),
  }));
  for (const { clip, trackIndex } of moving) {
    audioTracks[trackIndex + tracks]?.clips.push({ ...clip, start: Number((clip.start + shift).toFixed(4)) });
  }
  return { ...project, audioTracks };
}

function fitFades(clip: AudioClip): AudioClip {
  const fadeIn = Math.min(clip.fadeIn, clip.duration);
  return { ...clip, fadeIn, fadeOut: Math.min(clip.fadeOut, clip.duration - fadeIn) };
}

/**
 * Moves one edge to project time `time`. The start edge reveals or hides the file's beginning (its
 * keyframes stay on the same sound); neither edge passes the file's ends or makes the clip too short.
 */
export function trimAudioClip(clip: AudioClip, edge: "start" | "end", time: number): AudioClip {
  if (edge === "end") {
    const duration = clamp(time - clip.start, MIN_CLIP_SECONDS, clip.fileDuration - clip.trimStart);
    return fitFades({
      ...clip,
      duration,
      volume: { ...clip.volume, keyframes: clip.volume.keyframes.filter((k) => k.at <= duration + 1e-6) },
    });
  }
  const start = clamp(time, Math.max(0, clip.start - clip.trimStart), audioEnd(clip) - MIN_CLIP_SECONDS);
  const shift = start - clip.start;
  const duration = clip.duration - shift;
  const keyframes = clip.volume.keyframes
    .map((keyframe) => ({ ...keyframe, at: keyframe.at - shift }))
    .filter((keyframe) => keyframe.at >= -1e-6 && keyframe.at <= duration + 1e-6)
    .map((keyframe) => ({ ...keyframe, at: clamp(keyframe.at, 0, duration) }));
  return fitFades({
    ...clip,
    start,
    trimStart: clip.trimStart + shift,
    duration,
    volume: { ...clip.volume, keyframes },
  });
}

/** Slides which part of the file plays, keeping the clip's start; it shortens if the file runs out. */
export function setAudioTrimStart(clip: AudioClip, trimStart: number): AudioClip {
  const next = clamp(trimStart, 0, clip.fileDuration - MIN_CLIP_SECONDS);
  const duration = Math.min(clip.duration, clip.fileDuration - next);
  return fitFades({
    ...clip,
    trimStart: next,
    duration,
    volume: { ...clip.volume, keyframes: clip.volume.keyframes.filter((k) => k.at <= duration + 1e-6) },
  });
}

export function setAudioFade(clip: AudioClip, side: "in" | "out", seconds: number): AudioClip {
  const other = side === "in" ? clip.fadeOut : clip.fadeIn;
  const value = Number(clamp(seconds, 0, Math.min(MAX_AUDIO_FADE_SECONDS, clip.duration - other)).toFixed(3));
  return side === "in" ? { ...clip, fadeIn: value } : { ...clip, fadeOut: value };
}

/** Like the inspector does for video properties: static without keyframes, else the keyframe at (or added at) `localTime`. */
export function setVolumeAt(clip: AudioClip, localTime: number, value: number): AudioClip {
  const next = clampVolume(value);
  if (clip.volume.keyframes.length === 0) return { ...clip, volume: { ...clip.volume, value: next } };
  const existing = keyframeAt(clip.volume, localTime);
  return withKeyframes(
    clip,
    existing
      ? clip.volume.keyframes.map((keyframe) =>
          keyframe.id === existing.id ? { ...keyframe, value: next } : keyframe
        )
      : [...clip.volume.keyframes, newKeyframe(localTime, next)]
  );
}

/** Adds a keyframe holding the current volume at `localTime`, or removes the one there. */
export function toggleVolumeKeyframeAt(clip: AudioClip, localTime: number): AudioClip {
  const existing = keyframeAt(clip.volume, localTime);
  if (!existing) return addVolumeKeyframeAt(clip, localTime);
  const keyframes = clip.volume.keyframes.filter((keyframe) => keyframe.id !== existing.id);
  const value = keyframes.length === 0 ? existing.value : clip.volume.value;
  return { ...clip, volume: { value, keyframes } };
}

export function addVolumeKeyframeAt(clip: AudioClip, localTime: number): AudioClip {
  if (keyframeAt(clip.volume, localTime)) return clip;
  const at = clamp(localTime, 0, clip.duration);
  return withKeyframes(clip, [...clip.volume.keyframes, newKeyframe(at, evaluateProperty(clip.volume, at))]);
}

export function moveVolumeKeyframes(
  clip: AudioClip,
  keyframeIds: readonly string[],
  delta: number
): AudioClip {
  const ids = new Set(keyframeIds);
  const moving = clip.volume.keyframes.filter((keyframe) => ids.has(keyframe.id));
  if (moving.length === 0) return clip;
  const shift = clamp(
    delta,
    -Math.min(...moving.map((keyframe) => keyframe.at)),
    clip.duration - Math.max(...moving.map((keyframe) => keyframe.at))
  );
  return withKeyframes(
    clip,
    clip.volume.keyframes.map((keyframe) =>
      ids.has(keyframe.id) ? { ...keyframe, at: Number((keyframe.at + shift).toFixed(4)) } : keyframe
    )
  );
}

export function setVolumeKeyframeEase(
  clip: AudioClip,
  keyframeIds: readonly string[],
  ease: Ease
): AudioClip {
  const ids = new Set(keyframeIds);
  return withKeyframes(
    clip,
    clip.volume.keyframes.map((keyframe) => (ids.has(keyframe.id) ? { ...keyframe, ease } : keyframe))
  );
}

/** Removing the last keyframe keeps the volume it held, so playback doesn't jump. */
export function removeVolumeKeyframes(clip: AudioClip, keyframeIds: readonly string[]): AudioClip {
  const ids = new Set(keyframeIds);
  const keyframes = clip.volume.keyframes.filter((keyframe) => !ids.has(keyframe.id));
  if (keyframes.length === clip.volume.keyframes.length) return clip;
  const removed = clip.volume.keyframes.find((keyframe) => ids.has(keyframe.id));
  const value = keyframes.length === 0 && removed ? removed.value : clip.volume.value;
  return { ...clip, volume: { value, keyframes } };
}

export function copyVolumeKeyframes(clip: AudioClip, keyframeIds: readonly string[]): CopiedVolumeKeyframe[] {
  const ids = new Set(keyframeIds);
  return clip.volume.keyframes
    .filter((keyframe) => ids.has(keyframe.id))
    .map(({ at, value, ease }) => ({ at, value, ease }));
}

/** Pastes with the earliest keyframe at `at`, keeping spacing and clamping to the clip; overwrites a keyframe already there. */
export function pasteVolumeKeyframes(
  clip: AudioClip,
  copied: readonly CopiedVolumeKeyframe[],
  at: number
): { clip: AudioClip; keyframeIds: string[] } {
  if (copied.length === 0) return { clip, keyframeIds: [] };
  const earliest = Math.min(...copied.map((keyframe) => keyframe.at));
  let next = clip;
  const keyframeIds: string[] = [];
  for (const keyframe of copied) {
    const time = clamp(at + keyframe.at - earliest, 0, clip.duration);
    const existing = keyframeAt(next.volume, time);
    const pasted = existing
      ? { ...existing, value: clampVolume(keyframe.value), ease: keyframe.ease }
      : newKeyframe(time, clampVolume(keyframe.value), keyframe.ease);
    next = withKeyframes(next, [...next.volume.keyframes.filter((k) => k.id !== pasted.id), pasted]);
    keyframeIds.push(pasted.id);
  }
  return { clip: next, keyframeIds };
}

/**
 * Cuts a clip at project time `time` into two that play the same sound. The first keeps the fade in,
 * the second the fade out; with keyframes, both get one at the cut holding the volume there.
 */
export function splitAudioClip(project: Project, clipId: string, time: number): Project {
  const found = findAudioClip(project, clipId);
  if (!found) return project;
  const { clip } = found;
  const cut = time - clip.start;
  if (cut < MIN_CLIP_SECONDS || clip.duration - cut < MIN_CLIP_SECONDS) return project;
  const animated = clip.volume.keyframes.length > 0;
  const atCut = evaluateProperty(clip.volume, cut);
  const before = clip.volume.keyframes.filter((keyframe) => keyframe.at < cut);
  const after = clip.volume.keyframes
    .filter((keyframe) => keyframe.at > cut)
    .map((keyframe) => ({ ...keyframe, at: keyframe.at - cut }));
  const left = fitFades(
    withKeyframes(
      { ...clip, duration: cut, fadeOut: 0 },
      animated ? [...before, newKeyframe(cut, atCut)] : []
    )
  );
  const right = fitFades(
    withKeyframes(
      {
        ...clip,
        id: crypto.randomUUID(),
        start: time,
        trimStart: clip.trimStart + cut,
        duration: clip.duration - cut,
        fadeIn: 0,
      },
      animated ? [newKeyframe(0, atCut), ...after] : []
    )
  );
  return updateAudioTrack(project, found.trackIndex, (track) => ({
    ...track,
    clips: track.clips.flatMap((candidate) => (candidate.id === clipId ? [left, right] : [candidate])),
  }));
}

function cloneAudioClip(clip: AudioClip, start: number): AudioClip {
  return {
    ...clip,
    id: crypto.randomUUID(),
    start,
    volume: {
      ...clip.volume,
      keyframes: clip.volume.keyframes.map((k) => ({ ...k, id: crypto.randomUUID() })),
    },
  };
}

/** Copies land right after the selection's end on their own tracks, keeping their spacing. */
export function duplicateAudioClips(
  project: Project,
  clipIds: readonly string[]
): { project: Project; clipIds: string[] } {
  const found = clipIds.map((id) => findAudioClip(project, id)).filter((entry) => entry !== null);
  if (found.length === 0) return { project, clipIds: [] };
  const offset =
    Math.max(...found.map(({ clip }) => audioEnd(clip))) - Math.min(...found.map(({ clip }) => clip.start));
  let next = project;
  const copies: string[] = [];
  for (const { clip, trackIndex } of found) {
    const copy = cloneAudioClip(clip, clip.start + offset);
    copies.push(copy.id);
    next = updateAudioTrack(next, trackIndex, (track) => ({ ...track, clips: [...track.clips, copy] }));
  }
  return { project: next, clipIds: copies };
}

/** Clip start and end times on every audio track, for snapping. */
export function audioClipEdges(project: Project, excludeClipIds: ReadonlySet<string>): number[] {
  return project.audioTracks.flatMap((track) =>
    track.clips.filter((clip) => !excludeClipIds.has(clip.id)).flatMap((clip) => [clip.start, audioEnd(clip)])
  );
}
