import { evaluateProperty } from "./property-evaluation";
import { PROPERTY_SPECS, type PropertyKey } from "./property-specs";
import { createVideoTrack } from "./storyboard-factories";
import {
  type AnimatedProperty,
  type Clip,
  type Ease,
  type Keyframe,
  MAX_CLIP_SECONDS,
  MAX_RECORDING_SECONDS,
  MAX_TRANSITION_SECONDS,
  type Project,
  type VideoTrack,
} from "./storyboard-schema";
import { clipEnd } from "./track-resolution";

/** Keyframes closer than this to the playhead count as "at" it. */
export const KEYFRAME_SNAP_SECONDS = 1 / 120;

export function findClip(project: Project, clipId: string): Clip | null {
  for (const track of project.videoTracks) {
    const clip = track.clips.find((candidate) => candidate.id === clipId);
    if (clip) return clip;
  }
  return null;
}

export function updateClip(project: Project, clipId: string, update: (clip: Clip) => Clip): Project {
  return {
    ...project,
    videoTracks: project.videoTracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => (clip.id === clipId ? update(clip) : clip)),
    })),
  };
}

function propertyOf(clip: Clip, key: PropertyKey): AnimatedProperty {
  return clip.properties[key] ?? { value: PROPERTY_SPECS[key].defaultValue, keyframes: [] };
}

function clampToSpec(key: PropertyKey, value: number): number {
  const spec = PROPERTY_SPECS[key];
  return Math.min(spec.max, Math.max(spec.min, value));
}

export function keyframeAt(
  property: AnimatedProperty,
  time: number,
  tolerance: number = KEYFRAME_SNAP_SECONDS
): Keyframe | null {
  return property.keyframes.find((keyframe) => Math.abs(keyframe.at - time) <= tolerance) ?? null;
}

function newKeyframe(time: number, value: number, ease: Ease = "ease-in-out"): Keyframe {
  return { id: crypto.randomUUID(), at: time, value, ease };
}

/**
 * Sets a property the way the inspector and canvas drags do: without keyframes it changes the static
 * value; with keyframes it updates the one at `time`, or adds one there.
 */
export function setPropertyAt(clip: Clip, key: PropertyKey, time: number, value: number): Clip {
  const property = propertyOf(clip, key);
  const next = clampToSpec(key, value);
  if (property.keyframes.length === 0) {
    return { ...clip, properties: { ...clip.properties, [key]: { ...property, value: next } } };
  }
  const existing = keyframeAt(property, time);
  const keyframes = existing
    ? property.keyframes.map((keyframe) =>
        keyframe.id === existing.id ? { ...keyframe, value: next } : keyframe
      )
    : [...property.keyframes, newKeyframe(time, next)].sort((a, b) => a.at - b.at);
  return { ...clip, properties: { ...clip.properties, [key]: { ...property, keyframes } } };
}

/** The inspector's diamond: adds a keyframe at `time` holding the current value, or removes the one there. */
export function toggleKeyframeAt(clip: Clip, key: PropertyKey, time: number): Clip {
  const property = propertyOf(clip, key);
  const existing = keyframeAt(property, time);
  if (existing) {
    const keyframes = property.keyframes.filter((keyframe) => keyframe.id !== existing.id);
    // Removing the last keyframe keeps the value it held, so the preview doesn't jump.
    const value = keyframes.length === 0 ? existing.value : property.value;
    return { ...clip, properties: { ...clip.properties, [key]: { value, keyframes } } };
  }
  const keyframes = [...property.keyframes, newKeyframe(time, evaluateProperty(property, time))].sort(
    (a, b) => a.at - b.at
  );
  return { ...clip, properties: { ...clip.properties, [key]: { ...property, keyframes } } };
}

export const MIN_CLIP_SECONDS = 0.1;
const EPSILON = 1e-6;

type Span = Pick<Clip, "start" | "duration">;

export type ClipLocation = { track: VideoTrack; trackIndex: number; clip: Clip };

export function findClipLocation(project: Project, clipId: string): ClipLocation | null {
  for (const [trackIndex, track] of project.videoTracks.entries()) {
    const clip = track.clips.find((candidate) => candidate.id === clipId);
    if (clip) return { track, trackIndex, clip };
  }
  return null;
}

/** Seconds into `clip` at project time `time`, held at its ends. */
export function clipLocalTime(clip: Span, time: number): number {
  return Math.min(clip.duration, Math.max(0, time - clip.start));
}

/** Recordings stop at the cap and imports at the end of their file. */
export function maxClipDuration(clip: Clip): number {
  if (clip.source.kind === "recording") return MAX_RECORDING_SECONDS;
  if (clip.source.kind === "import")
    return Math.min(MAX_CLIP_SECONDS, clip.source.fileDuration - clip.source.trimStart);
  return MAX_CLIP_SECONDS;
}

/** The same overlap rules as `videoTrackSchema`, for checking a placement before committing it. */
export function spansAreValid(spans: Span[]): boolean {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  for (const [index, clip] of sorted.entries()) {
    if (clip.start < -EPSILON) return false;
    const previous = sorted[index - 1];
    if (!previous) continue;
    const overlap = clipEnd(previous) - clip.start;
    if (overlap <= EPSILON) continue;
    if (overlap > MAX_TRANSITION_SECONDS + EPSILON) return false;
    if (overlap >= Math.min(previous.duration, clip.duration) - EPSILON) return false;
    const beforePrevious = sorted[index - 2];
    if (beforePrevious && clipEnd(beforePrevious) > clip.start + EPSILON) return false;
  }
  return true;
}

/** Overlaps stop short of covering either clip, so both stay selectable. */
function maxOverlap(a: number, b: number): number {
  return Math.max(0, Math.min(MAX_TRANSITION_SECONDS, Math.min(a, b) - MIN_CLIP_SECONDS));
}

function nearest(candidates: number[], target: number, isValid: (value: number) => boolean): number | null {
  let best: number | null = null;
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate) || !isValid(candidate)) continue;
    if (best === null || Math.abs(candidate - target) < Math.abs(best - target)) best = candidate;
  }
  return best;
}

/** The start closest to `desired` where a clip of `duration` fits among `others`. */
export function nearestValidStart(others: Span[], duration: number, desired: number): number {
  const candidates = [Math.max(0, desired), 0];
  for (const other of others) {
    const overlap = maxOverlap(other.duration, duration);
    candidates.push(
      clipEnd(other) - overlap,
      clipEnd(other),
      other.start + overlap - duration,
      other.start - duration
    );
  }
  const start = nearest(candidates, desired, (value) =>
    spansAreValid([...others, { start: value, duration }])
  );
  return start ?? Math.max(0, ...others.map(clipEnd));
}

function sortedClips(clips: Clip[]): Clip[] {
  return [...clips].sort((a, b) => a.start - b.start);
}

function withoutClip(project: Project, clipId: string): Project {
  return {
    ...project,
    videoTracks: project.videoTracks.map((track) => ({
      ...track,
      clips: track.clips.filter((clip) => clip.id !== clipId),
    })),
  };
}

function withClipOnTrack(project: Project, trackIndex: number, clip: Clip): Project {
  return {
    ...project,
    videoTracks: project.videoTracks.map((track, index) =>
      index === trackIndex ? { ...track, clips: sortedClips([...track.clips, clip]) } : track
    ),
  };
}

/** Moves a clip to `trackIndex` at the valid start nearest to `start`. */
export function moveClip(
  project: Project,
  clipId: string,
  { start, trackIndex }: { start: number; trackIndex: number }
): Project {
  const location = findClipLocation(project, clipId);
  const target = project.videoTracks[trackIndex];
  if (!location || !target) return project;
  const others = target.clips.filter((clip) => clip.id !== clipId);
  const placed = { ...location.clip, start: nearestValidStart(others, location.clip.duration, start) };
  return withClipOnTrack(withoutClip(project, clipId), trackIndex, placed);
}

function clampTimes(clip: Clip, shift: number, duration: number): Clip {
  const retime = (at: number) => Math.min(duration, Math.max(0, at - shift));
  const properties = Object.fromEntries(
    Object.entries(clip.properties).map(([key, property]) => [
      key,
      {
        ...property,
        keyframes: property.keyframes.map((keyframe) => ({ ...keyframe, at: retime(keyframe.at) })),
      },
    ])
  );
  const source =
    clip.source.kind === "recording"
      ? {
          ...clip.source,
          actions: clip.source.actions.map((action) => ({ ...action, at: retime(action.at) })),
        }
      : clip.source;
  return { ...clip, duration, properties, source };
}

/**
 * Drags an edge to `time`, clamped to the clip's length limits and the track's overlap rules. The start
 * edge keeps keyframes and actions where they are in project time; on imports it also moves the trim.
 */
export function trimClip(project: Project, clipId: string, edge: "start" | "end", time: number): Project {
  const location = findClipLocation(project, clipId);
  if (!location) return project;
  const { clip, track } = location;
  const others = track.clips.filter((other) => other.id !== clipId);
  const maxDuration = maxClipDuration(clip);

  if (edge === "end") {
    const requested = Math.min(maxDuration, Math.max(MIN_CLIP_SECONDS, time - clip.start));
    const candidates = [requested, clip.duration];
    for (const other of others) {
      if (other.start < clip.start) continue;
      candidates.push(other.start - clip.start);
      for (const length of [requested, other.duration]) {
        candidates.push(other.start + maxOverlap(other.duration, length) - clip.start);
      }
    }
    const duration =
      nearest(
        candidates,
        requested,
        (value) =>
          value >= MIN_CLIP_SECONDS - EPSILON &&
          value <= maxDuration + EPSILON &&
          spansAreValid([...others, { start: clip.start, duration: value }])
      ) ?? clip.duration;
    return updateClip(project, clipId, (current) => clampTimes(current, 0, duration));
  }

  const end = clipEnd(clip);
  const earliest = Math.max(
    0,
    end - maxDuration,
    clip.source.kind === "import" ? clip.start - clip.source.trimStart : 0
  );
  const requested = Math.min(end - MIN_CLIP_SECONDS, Math.max(earliest, time));
  const candidates = [requested, clip.start];
  for (const other of others) {
    if (other.start > clip.start) continue;
    candidates.push(clipEnd(other));
    for (const length of [end - requested, other.duration]) {
      candidates.push(clipEnd(other) - maxOverlap(other.duration, length));
    }
  }
  const start =
    nearest(
      candidates,
      requested,
      (value) =>
        value >= earliest - EPSILON &&
        value <= end - MIN_CLIP_SECONDS + EPSILON &&
        spansAreValid([...others, { start: value, duration: end - value }])
    ) ?? clip.start;
  const shift = start - clip.start;
  const trimmed = clampTimes({ ...clip, start }, shift, end - start);
  const source =
    trimmed.source.kind === "import"
      ? { ...trimmed.source, trimStart: Math.max(0, trimmed.source.trimStart + shift) }
      : trimmed.source;
  return updateClip(project, clipId, () => ({ ...trimmed, source }));
}

export function setClipStart(project: Project, clipId: string, start: number): Project {
  const location = findClipLocation(project, clipId);
  return location ? moveClip(project, clipId, { start, trackIndex: location.trackIndex }) : project;
}

export function setClipDuration(project: Project, clipId: string, duration: number): Project {
  const clip = findClip(project, clipId);
  return clip ? trimClip(project, clipId, "end", clip.start + duration) : project;
}

/** Adds `clip` at its own start when the track allows it, otherwise after the track's last clip. */
export function placeClip(project: Project, trackIndex: number, clip: Clip): Project {
  const track = project.videoTracks[trackIndex];
  if (!track) return project;
  const fits = spansAreValid([...track.clips, clip]);
  const start = fits ? clip.start : Math.max(0, ...track.clips.map(clipEnd));
  return withClipOnTrack(project, trackIndex, { ...clip, start });
}

export function removeClip(project: Project, clipId: string): Project {
  return withoutClip(project, clipId);
}

/** Copies a clip with fresh ids right after the original, or after the track's last clip. */
export function duplicateClip(project: Project, clipId: string): { project: Project; clipId: string } | null {
  const location = findClipLocation(project, clipId);
  if (!location) return null;
  const { clip, trackIndex } = location;
  const properties = Object.fromEntries(
    Object.entries(clip.properties).map(([key, property]) => [
      key,
      {
        ...property,
        keyframes: property.keyframes.map((keyframe) => ({ ...keyframe, id: crypto.randomUUID() })),
      },
    ])
  );
  const copy: Clip = { ...clip, id: crypto.randomUUID(), start: clipEnd(clip), properties };
  return { project: placeClip(project, trackIndex, copy), clipId: copy.id };
}

export function addVideoTrack(project: Project, name: string): Project {
  return { ...project, videoTracks: [...project.videoTracks, createVideoTrack(name)] };
}

/** How far a clip starts inside the previous clip on its track; 0 when they don't overlap. */
export function incomingOverlap(track: VideoTrack, clipId: string): number {
  const clips = sortedClips(track.clips);
  const index = clips.findIndex((clip) => clip.id === clipId);
  const previous = clips[index - 1];
  if (index <= 0 || !previous) return 0;
  return Math.max(0, clipEnd(previous) - clips[index].start);
}

function updateKeyframes(clip: Clip, key: PropertyKey, update: (keyframes: Keyframe[]) => Keyframe[]): Clip {
  const property = clip.properties[key];
  if (!property) return clip;
  const keyframes = update(property.keyframes).sort((a, b) => a.at - b.at);
  return { ...clip, properties: { ...clip.properties, [key]: { ...property, keyframes } } };
}

export function moveKeyframe(clip: Clip, key: PropertyKey, keyframeId: string, at: number): Clip {
  const time = Math.min(clip.duration, Math.max(0, at));
  return updateKeyframes(clip, key, (keyframes) =>
    keyframes.map((keyframe) => (keyframe.id === keyframeId ? { ...keyframe, at: time } : keyframe))
  );
}

export function setKeyframeEase(clip: Clip, key: PropertyKey, keyframeId: string, ease: Ease): Clip {
  return updateKeyframes(clip, key, (keyframes) =>
    keyframes.map((keyframe) => (keyframe.id === keyframeId ? { ...keyframe, ease } : keyframe))
  );
}

/** Removing the last keyframe keeps the value it held, as the diamond does. */
export function removeKeyframe(clip: Clip, key: PropertyKey, keyframeId: string): Clip {
  const property = clip.properties[key];
  const removed = property?.keyframes.find((keyframe) => keyframe.id === keyframeId);
  if (!property || !removed) return clip;
  const keyframes = property.keyframes.filter((keyframe) => keyframe.id !== keyframeId);
  const value = keyframes.length === 0 ? removed.value : property.value;
  return { ...clip, properties: { ...clip.properties, [key]: { value, keyframes } } };
}

/** A keyframe within a clip, as the timeline selects it. */
export type KeyframeRef = { key: PropertyKey; keyframeId: string };

/** A copy with fresh clip and keyframe ids. */
export function cloneClip(clip: Clip, start: number = clip.start): Clip {
  const properties = Object.fromEntries(
    Object.entries(clip.properties).map(([key, property]) => [
      key,
      {
        ...property,
        keyframes: property.keyframes.map((keyframe) => ({ ...keyframe, id: crypto.randomUUID() })),
      },
    ])
  );
  return { ...clip, id: crypto.randomUUID(), start, properties };
}

/**
 * Cuts a clip at project time `time` into two that play back the same: keyframed properties get a
 * keyframe on each side of the cut holding the value there. Null when `time` is too close to an edge.
 */
export function splitClip(
  project: Project,
  clipId: string,
  time: number
): { project: Project; clipId: string } | null {
  const location = findClipLocation(project, clipId);
  if (!location) return null;
  const { clip, trackIndex } = location;
  const cut = time - clip.start;
  if (cut < MIN_CLIP_SECONDS - EPSILON || cut > clip.duration - MIN_CLIP_SECONDS + EPSILON) return null;

  const head: Clip = { ...clip, duration: cut, properties: {} };
  const tail: Clip = { ...cloneClip(clip, time), duration: clip.duration - cut, properties: {} };
  for (const [key, property] of Object.entries(clip.properties) as Array<[PropertyKey, AnimatedProperty]>) {
    if (property.keyframes.length === 0) {
      head.properties[key] = property;
      tail.properties[key] = property;
      continue;
    }
    const value = evaluateProperty(property, cut);
    const before = property.keyframes.filter((keyframe) => keyframe.at < cut - EPSILON);
    const after = property.keyframes.filter((keyframe) => keyframe.at > cut + EPSILON);
    const ease = after[0]?.ease ?? "linear";
    head.properties[key] = { ...property, keyframes: [...before, newKeyframe(cut, value, ease)] };
    tail.properties[key] = {
      ...property,
      keyframes: [
        newKeyframe(0, value, "linear"),
        ...after.map((keyframe) => ({ ...keyframe, id: crypto.randomUUID(), at: keyframe.at - cut })),
      ],
    };
  }
  if (clip.source.kind === "recording") {
    head.source = { ...clip.source, actions: clip.source.actions.filter((action) => action.at <= cut) };
    tail.source = {
      ...clip.source,
      actions: clip.source.actions
        .filter((action) => action.at > cut)
        .map((action) => ({ ...action, at: action.at - cut })),
    };
  }
  if (clip.source.kind === "import") tail.source = { ...clip.source, trimStart: clip.source.trimStart + cut };
  const withHead = updateClip(project, clipId, () => head);
  return { project: withClipOnTrack(withHead, trackIndex, tail), clipId: tail.id };
}

export function removeClips(project: Project, clipIds: string[]): Project {
  const ids = new Set(clipIds);
  return {
    ...project,
    videoTracks: project.videoTracks.map((track) => ({
      ...track,
      clips: track.clips.filter((clip) => !ids.has(clip.id)),
    })),
  };
}

export type ClipOnTrack = { clip: Clip; trackIndex: number };

export function clipsWithTracks(project: Project, clipIds: string[]): ClipOnTrack[] {
  return clipIds.flatMap((clipId) => {
    const location = findClipLocation(project, clipId);
    return location ? [{ clip: location.clip, trackIndex: location.trackIndex }] : [];
  });
}

/** Places copies of `entries` keeping their spacing, the earliest at `at`, each on its own track when it exists. */
export function pasteClips(
  project: Project,
  entries: ClipOnTrack[],
  at: number
): { project: Project; clipIds: string[] } {
  if (entries.length === 0) return { project, clipIds: [] };
  const offset = at - Math.min(...entries.map((entry) => entry.clip.start));
  const clipIds: string[] = [];
  let next = project;
  for (const { clip, trackIndex } of [...entries].sort((a, b) => a.clip.start - b.clip.start)) {
    const copy = cloneClip(clip, Math.max(0, clip.start + offset));
    next = placeClip(next, Math.min(trackIndex, next.videoTracks.length - 1), copy);
    clipIds.push(copy.id);
  }
  return { project: next, clipIds };
}

/** Copies the clips right after the selection's own span. */
export function duplicateClips(project: Project, clipIds: string[]): { project: Project; clipIds: string[] } {
  const entries = clipsWithTracks(project, clipIds);
  if (entries.length === 0) return { project, clipIds: [] };
  return pasteClips(project, entries, Math.max(...entries.map((entry) => clipEnd(entry.clip))));
}

/** Moves clips together by `delta` seconds and `trackDelta` tracks; null when any landing spot is invalid. */
export function moveClips(
  project: Project,
  clipIds: string[],
  delta: number,
  trackDelta = 0
): Project | null {
  const entries = clipsWithTracks(project, clipIds);
  const moved = entries.map(({ clip, trackIndex }) => ({
    clip: { ...clip, start: clip.start + delta },
    trackIndex: trackIndex + trackDelta,
  }));
  if (moved.some(({ clip, trackIndex }) => clip.start < -EPSILON || !project.videoTracks[trackIndex]))
    return null;
  let next = removeClips(project, clipIds);
  for (const { clip, trackIndex } of moved)
    next = withClipOnTrack(next, trackIndex, { ...clip, start: Math.max(0, clip.start) });
  return next.videoTracks.every((track) => spansAreValid(track.clips)) ? next : null;
}

/** Adds an empty video track when `trackIndex` is one above the top track, e.g. a drop on the new-track row. */
export function ensureVideoTrack(project: Project, trackIndex: number, name: string): Project {
  return trackIndex === project.videoTracks.length ? addVideoTrack(project, name) : project;
}

export function insertVideoTrack(project: Project, index: number, name: string): Project {
  const videoTracks = [...project.videoTracks];
  videoTracks.splice(Math.min(Math.max(0, index), videoTracks.length), 0, createVideoTrack(name));
  return { ...project, videoTracks };
}

/** Inserts a deep copy above the original. */
export function duplicateVideoTrack(project: Project, trackIndex: number, name: string): Project {
  const track = project.videoTracks[trackIndex];
  if (!track) return project;
  const copy: VideoTrack = {
    ...createVideoTrack(name),
    hidden: track.hidden,
    clips: track.clips.map((clip) => cloneClip(clip)),
  };
  const videoTracks = [...project.videoTracks];
  videoTracks.splice(trackIndex + 1, 0, copy);
  return { ...project, videoTracks };
}

/** The last video track can't be removed. */
export function removeVideoTrack(project: Project, trackIndex: number): Project {
  if (project.videoTracks.length <= 1) return project;
  return { ...project, videoTracks: project.videoTracks.filter((_, index) => index !== trackIndex) };
}

export function updateVideoTrack(
  project: Project,
  trackIndex: number,
  update: (track: VideoTrack) => VideoTrack
): Project {
  return {
    ...project,
    videoTracks: project.videoTracks.map((track, index) => (index === trackIndex ? update(track) : track)),
  };
}

function previousClip(track: VideoTrack, clipId: string): Clip | null {
  const clips = sortedClips(track.clips);
  const index = clips.findIndex((clip) => clip.id === clipId);
  return index > 0 ? (clips[index - 1] ?? null) : null;
}

/** Sets the overlap with the previous clip by moving the incoming clip, clamped like a drag. */
export function setTransitionLength(project: Project, clipId: string, seconds: number): Project {
  const location = findClipLocation(project, clipId);
  const previous = location ? previousClip(location.track, clipId) : null;
  if (!location || !previous) return project;
  return moveClip(project, clipId, { start: clipEnd(previous) - seconds, trackIndex: location.trackIndex });
}

/** Moves the incoming clip to start where the previous one ends. */
export function removeTransition(project: Project, clipId: string): Project {
  return setTransitionLength(project, clipId, 0);
}

/** Adds a keyframe holding the current value for each key that has none at `time`. */
export function addKeyframesAt(clip: Clip, keys: readonly PropertyKey[], time: number): Clip {
  return keys.reduce(
    (current, key) =>
      keyframeAt(propertyOf(current, key), time) ? current : toggleKeyframeAt(current, key, time),
    clip
  );
}

/** Removes the keyframes at `time` when every key has one there, otherwise adds the missing ones. */
export function toggleKeyframesAt(clip: Clip, keys: readonly PropertyKey[], time: number): Clip {
  const allKeyed = keys.every((key) => keyframeAt(propertyOf(clip, key), time));
  if (!allKeyed) return addKeyframesAt(clip, keys, time);
  return keys.reduce((current, key) => toggleKeyframeAt(current, key, time), clip);
}

export function removeKeyframes(clip: Clip, refs: readonly KeyframeRef[]): Clip {
  return refs.reduce((current, ref) => removeKeyframe(current, ref.key, ref.keyframeId), clip);
}

/** Shifts keyframes together, limiting `delta` so none leaves the clip. */
export function shiftKeyframes(clip: Clip, refs: readonly KeyframeRef[], delta: number): Clip {
  const times = refs.flatMap(
    (ref) => clip.properties[ref.key]?.keyframes.find((k) => k.id === ref.keyframeId)?.at ?? []
  );
  if (times.length === 0) return clip;
  const shift = Math.min(clip.duration - Math.max(...times), Math.max(-Math.min(...times), delta));
  return refs.reduce((current, ref) => {
    const keyframe = current.properties[ref.key]?.keyframes.find((k) => k.id === ref.keyframeId);
    return keyframe ? moveKeyframe(current, ref.key, ref.keyframeId, keyframe.at + shift) : current;
  }, clip);
}

/** Drops each property's keyframes, keeping the value it has at clip time `time`. */
export function removeLanes(clip: Clip, keys: readonly PropertyKey[], time: number): Clip {
  const properties = { ...clip.properties };
  for (const key of keys) {
    const property = properties[key];
    if (property) properties[key] = { value: evaluateProperty(property, time), keyframes: [] };
  }
  return { ...clip, properties };
}

export function resetProperty(clip: Clip, key: PropertyKey): Clip {
  const { [key]: _removed, ...properties } = clip.properties;
  return { ...clip, properties };
}

export function resetCamera(clip: Clip): Clip {
  return (Object.keys(clip.properties) as PropertyKey[])
    .filter((key) => PROPERTY_SPECS[key].group === "camera")
    .reduce(resetProperty, clip);
}

/** Sorted, de-duplicated keyframe times of a clip, limited to `refs` when given. */
export function keyframeTimes(clip: Clip, refs?: readonly KeyframeRef[]): number[] {
  const ids = refs ? new Set(refs.map((ref) => ref.keyframeId)) : null;
  const times = Object.values(clip.properties).flatMap((property) =>
    property.keyframes.filter((keyframe) => !ids || ids.has(keyframe.id)).map((keyframe) => keyframe.at)
  );
  return [...new Set(times)].sort((a, b) => a - b);
}

/** Adds `clip` at the valid start nearest its own, as a drop or paste does. */
export function placeClipNearest(project: Project, trackIndex: number, clip: Clip): Project {
  const track = project.videoTracks[trackIndex];
  if (!track) return project;
  return withClipOnTrack(project, trackIndex, {
    ...clip,
    start: nearestValidStart(track.clips, clip.duration, clip.start),
  });
}

export type CopiedKeyframe = { key: PropertyKey; at: number; value: number; ease: Ease };

/** Pasted keyframes land this many frames after the keyframe they're pasted onto. */
export const PASTE_OFFSET_FRAMES = 5;

export function keyframePasteTime(anchorAt: number, fps: number): number {
  return anchorAt + PASTE_OFFSET_FRAMES / fps;
}

export function copyKeyframes(clip: Clip, refs: readonly KeyframeRef[]): CopiedKeyframe[] {
  return refs.flatMap((ref) => {
    const keyframe = clip.properties[ref.key]?.keyframes.find((candidate) => candidate.id === ref.keyframeId);
    return keyframe ? [{ key: ref.key, at: keyframe.at, value: keyframe.value, ease: keyframe.ease }] : [];
  });
}

/**
 * Pastes keyframes with the earliest at clip time `at`, keeping their spacing and clamping to the clip.
 * A keyframe already at a landing time is overwritten. `key` sends them all to one property's lane.
 */
export function pasteKeyframes(
  clip: Clip,
  copied: readonly CopiedKeyframe[],
  at: number,
  key?: PropertyKey
): { clip: Clip; refs: KeyframeRef[] } {
  if (copied.length === 0) return { clip, refs: [] };
  const earliest = Math.min(...copied.map((keyframe) => keyframe.at));
  const refs: KeyframeRef[] = [];
  let next = clip;
  for (const keyframe of copied) {
    const target = key ?? keyframe.key;
    const time = Math.min(clip.duration, Math.max(0, at + keyframe.at - earliest));
    const value = clampToSpec(target, keyframe.value);
    const property = propertyOf(next, target);
    const existing = keyframeAt(property, time);
    const pasted = existing
      ? { ...existing, value, ease: keyframe.ease }
      : newKeyframe(time, value, keyframe.ease);
    const keyframes = [...property.keyframes.filter((candidate) => candidate.id !== pasted.id), pasted].sort(
      (a, b) => a.at - b.at
    );
    next = { ...next, properties: { ...next.properties, [target]: { ...property, keyframes } } };
    refs.push({ key: target, keyframeId: pasted.id });
  }
  return { clip: next, refs };
}

/** Properties that move together: editing one axis of a keyed compound keys all of its axes. */
export const COMPOUND_PROPERTIES: readonly (readonly PropertyKey[])[] = [
  ["rotateX", "rotateY", "rotateZ"],
  ["cameraX", "cameraY", "cameraZ"],
  ["panX", "panY"],
  ["focusX", "focusY"],
];

export function compoundOf(key: PropertyKey): readonly PropertyKey[] {
  return COMPOUND_PROPERTIES.find((keys) => keys.includes(key)) ?? [key];
}

/** Nearest frame of the project's grid. */
export function snapToFrame(time: number, fps: number): number {
  return Math.round(time * fps) / fps;
}

/** A keyframe within half a frame of a time is "at" it. */
export function frameTolerance(fps: number): number {
  return 0.5 / fps;
}

/** Clip time of the frame nearest project time `time`; quantised in project time so off-grid clip starts still land on frames. */
export function frameLocalTime(clip: Span, time: number, fps: number): number {
  return clipLocalTime(clip, snapToFrame(time, fps));
}

/**
 * Moves every keyframe onto the frame grid (in project time), keeping one keyframe per frame per
 * property. Returns the same clip when nothing moved.
 */
export function quantiseClipKeyframes(clip: Clip, fps: number): Clip {
  let changed = false;
  const properties = Object.fromEntries(
    Object.entries(clip.properties).map(([key, property]) => {
      const byFrame = new Map<number, Keyframe>();
      for (const keyframe of [...property.keyframes].sort((a, b) => a.at - b.at)) {
        const at = frameLocalTime(clip, clip.start + keyframe.at, fps);
        if (Math.abs(at - keyframe.at) > EPSILON) changed = true;
        const frame = Math.round((clip.start + at) * fps);
        if (byFrame.has(frame)) changed = true;
        byFrame.set(frame, { ...keyframe, at });
      }
      return [key, { ...property, keyframes: [...byFrame.values()] }];
    })
  );
  return changed ? { ...clip, properties } : clip;
}

export function quantiseProjectKeyframes(project: Project): Project {
  let changed = false;
  const videoTracks = project.videoTracks.map((track) => {
    const clips = track.clips.map((clip) => quantiseClipKeyframes(clip, project.settings.fps));
    if (clips.every((clip, index) => clip === track.clips[index])) return track;
    changed = true;
    return { ...track, clips };
  });
  return changed ? { ...project, videoTracks } : project;
}

/**
 * Sets `key` at clip time `time`. When any axis of its compound is keyframed, every axis gets a
 * keyframe there (the others holding their current value), so the compound animates as one.
 */
export function setCompoundPropertyAt(clip: Clip, key: PropertyKey, time: number, value: number): Clip {
  const keys = compoundOf(key);
  const keyed = keys.some((candidate) => (clip.properties[candidate]?.keyframes.length ?? 0) > 0);
  return setPropertyAt(keyed ? addKeyframesAt(clip, keys, time) : clip, key, time, value);
}

/**
 * The clip time an edit of `keys` applies to: a selected keyframe of those keys within half a frame of
 * the playhead wins, otherwise the playhead's frame.
 */
export function editTimeFor(
  clip: Clip,
  keys: readonly PropertyKey[],
  selected: readonly KeyframeRef[],
  playheadLocal: number,
  fps: number
): number {
  const tolerance = frameTolerance(fps);
  let best: number | null = null;
  for (const ref of selected) {
    if (!keys.includes(ref.key)) continue;
    const at = clip.properties[ref.key]?.keyframes.find((keyframe) => keyframe.id === ref.keyframeId)?.at;
    if (at === undefined || Math.abs(at - playheadLocal) > tolerance) continue;
    if (best === null || Math.abs(at - playheadLocal) < Math.abs(best - playheadLocal)) best = at;
  }
  return best ?? playheadLocal;
}

/** The clip time an edit at project time `time` lands on: its frame, held to the clip's last drawn frame, since a clip isn't drawn at its end. */
export function editLocalTime(clip: Span, time: number, fps: number): number {
  const lastFrame = Math.ceil(clipEnd(clip) * fps - EPSILON) - 1;
  return Math.min(frameLocalTime(clip, time, fps), Math.max(0, lastFrame / fps - clip.start));
}

/** Keys each of `keys` that has no keyframes and a static value other than its default at `time`, holding that value. */
export function keyStaticPose(clip: Clip, keys: readonly PropertyKey[], time: number): Clip {
  return keys.reduce((current, key) => {
    const property = current.properties[key];
    if (!property || property.keyframes.length > 0 || property.value === PROPERTY_SPECS[key].defaultValue)
      return current;
    return toggleKeyframeAt(current, key, time);
  }, clip);
}

/**
 * Before keying `keys` at `time`, keys the static pose set at `posedAt` (at the clip start when `time` is
 * later), so the new keyframe animates from that pose instead of replacing it.
 */
export function keyPoseBefore(clip: Clip, keys: readonly PropertyKey[], time: number, posedAt: number): Clip {
  if (Math.abs(time - posedAt) <= KEYFRAME_SNAP_SECONDS) return clip;
  return keyStaticPose(clip, keys, time > posedAt ? 0 : posedAt);
}
