import type { KeyframeRef } from "@coss/vaunt-engine/storyboard/storyboard-edits";
import type { Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { lockedClipIds } from "./track-locks";

export type SelectedKeyframe = KeyframeRef & { clipId: string };

/** The last clip id is the primary one the inspector shows. */
export type EditorSelection = { clipIds: string[]; keyframes: SelectedKeyframe[] };

export const EMPTY_SELECTION: EditorSelection = { clipIds: [], keyframes: [] };

export function primaryClipId(selection: EditorSelection): string | null {
  return selection.clipIds[selection.clipIds.length - 1] ?? null;
}

/** A plain click selects one clip; an additive click toggles it within the selection. */
export function selectClip(selection: EditorSelection, clipId: string, additive: boolean): EditorSelection {
  if (!additive) return { clipIds: [clipId], keyframes: [] };
  const clipIds = selection.clipIds.includes(clipId)
    ? selection.clipIds.filter((id) => id !== clipId)
    : [...selection.clipIds, clipId];
  return { clipIds, keyframes: selection.keyframes.filter((keyframe) => clipIds.includes(keyframe.clipId)) };
}

export function selectClips(
  selection: EditorSelection,
  clipIds: string[],
  additive: boolean
): EditorSelection {
  if (!additive) return { clipIds, keyframes: [] };
  return { ...selection, clipIds: [...new Set([...selection.clipIds, ...clipIds])] };
}

const sameKeyframe = (a: SelectedKeyframe, b: SelectedKeyframe) => a.keyframeId === b.keyframeId;

/** Keyframes belong to the primary clip, so selecting one keeps that clip primary. */
export function selectKeyframes(
  selection: EditorSelection,
  keyframes: SelectedKeyframe[],
  additive: boolean
): EditorSelection {
  const clipId = keyframes[0]?.clipId;
  const clipIds =
    clipId && !selection.clipIds.includes(clipId) ? [...selection.clipIds, clipId] : selection.clipIds;
  if (!additive) return { clipIds, keyframes };
  const toggled = keyframes.filter(
    (keyframe) => !selection.keyframes.some((other) => sameKeyframe(keyframe, other))
  );
  const kept = selection.keyframes.filter(
    (keyframe) => !keyframes.some((other) => sameKeyframe(keyframe, other))
  );
  return { clipIds, keyframes: [...kept, ...toggled] };
}

/** Drops ids that no longer exist, e.g. after undo or delete, and clips on locked tracks. */
export function pruneSelection(selection: EditorSelection, project: Project): EditorSelection {
  const locked = lockedClipIds(project);
  const clips = new Map(
    project.videoTracks.flatMap((track) =>
      track.clips.filter((clip) => !locked.has(clip.id)).map((clip) => [clip.id, clip] as const)
    )
  );
  const clipIds = selection.clipIds.filter((id) => clips.has(id));
  const keyframes = selection.keyframes.filter((keyframe) =>
    clips.get(keyframe.clipId)?.properties[keyframe.key]?.keyframes.some((k) => k.id === keyframe.keyframeId)
  );
  if (clipIds.length === selection.clipIds.length && keyframes.length === selection.keyframes.length)
    return selection;
  return { clipIds, keyframes };
}
