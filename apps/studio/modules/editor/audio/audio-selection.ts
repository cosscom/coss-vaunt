import type { Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { useSyncExternalStore } from "react";
import type { PlaybackClock } from "../player/playback-clock";

/** The last clip id is the primary one; selected keyframes belong to it. */
export type AudioSelection = { clipIds: string[]; keyframeIds: string[] };

export const EMPTY_AUDIO_SELECTION: AudioSelection = { clipIds: [], keyframeIds: [] };

export function primaryAudioClipId(selection: AudioSelection): string | null {
  return selection.clipIds[selection.clipIds.length - 1] ?? null;
}

/** A plain click selects one clip; Shift or ⌘ toggles it within the selection. */
export function selectAudioClip(
  selection: AudioSelection,
  clipId: string,
  additive: boolean
): AudioSelection {
  if (!additive) return { clipIds: [clipId], keyframeIds: [] };
  const clipIds = selection.clipIds.includes(clipId)
    ? selection.clipIds.filter((id) => id !== clipId)
    : [...selection.clipIds, clipId];
  return {
    clipIds,
    keyframeIds:
      primaryAudioClipId({ clipIds, keyframeIds: [] }) === primaryAudioClipId(selection)
        ? selection.keyframeIds
        : [],
  };
}

/** Selecting a keyframe makes its clip primary. */
export function selectVolumeKeyframes(
  selection: AudioSelection,
  clipId: string,
  keyframeIds: string[],
  additive: boolean
): AudioSelection {
  const clipIds = [...selection.clipIds.filter((id) => id !== clipId), clipId];
  if (!additive || primaryAudioClipId(selection) !== clipId) return { clipIds, keyframeIds };
  const toggled = keyframeIds.filter((id) => !selection.keyframeIds.includes(id));
  const kept = selection.keyframeIds.filter((id) => !keyframeIds.includes(id));
  return { clipIds, keyframeIds: [...kept, ...toggled] };
}

/** Drops ids that no longer exist, e.g. after undo or delete. */
export function pruneAudioSelection(selection: AudioSelection, project: Project): AudioSelection {
  const clips = new Map(
    project.audioTracks.flatMap((track) => track.clips.map((clip) => [clip.id, clip] as const))
  );
  const clipIds = selection.clipIds.filter((id) => clips.has(id));
  const primary = clips.get(primaryAudioClipId({ clipIds, keyframeIds: [] }) ?? "");
  const keyframeIds = selection.keyframeIds.filter((id) =>
    primary?.volume.keyframes.some((k) => k.id === id)
  );
  if (clipIds.length === selection.clipIds.length && keyframeIds.length === selection.keyframeIds.length) {
    return selection;
  }
  return { clipIds, keyframeIds };
}

export type AudioSelectionStore = {
  get: () => AudioSelection;
  set: (next: AudioSelection) => void;
  subscribe: (listener: () => void) => () => void;
};

function createAudioSelectionStore(): AudioSelectionStore {
  let selection = EMPTY_AUDIO_SELECTION;
  const listeners = new Set<() => void>();
  return {
    get: () => selection,
    set: (next) => {
      if (next === selection) return;
      selection = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const stores = new WeakMap<PlaybackClock, AudioSelectionStore>();

/** One audio selection per editor, keyed by its clock so the timeline and inspector share it. */
export function audioSelectionFor(clock: PlaybackClock): AudioSelectionStore {
  let store = stores.get(clock);
  if (!store) {
    store = createAudioSelectionStore();
    stores.set(clock, store);
  }
  return store;
}

export function useAudioSelection(store: AudioSelectionStore): AudioSelection {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
