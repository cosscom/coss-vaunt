"use client";

import {
  addAudioTrack,
  addVolumeKeyframeAt,
  type CopiedVolumeKeyframe,
  copyVolumeKeyframes,
  duplicateAudioClips,
  findAudioClip,
  pasteVolumeKeyframes,
  placeAudioClips,
  removeAudioClips,
  removeVolumeKeyframes,
  setVolumeKeyframeEase,
  splitAudioClip,
  toggleVolumeKeyframeAt,
  updateAudioClip,
  updateAudioTrack,
} from "@calcom/product-video/audio/audio-edits";
import { keyframePasteTime } from "@calcom/product-video/storyboard/storyboard-edits";
import type { Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { useState } from "react";
import { AUDIO_COPY } from "../../audio/audio-copy";
import {
  type AudioSelection,
  type AudioSelectionStore,
  EMPTY_AUDIO_SELECTION,
  primaryAudioClipId,
} from "../../audio/audio-selection";
import type { MediaImport } from "../../media/use-media-import";
import type { PlaybackClock } from "../../player/playback-clock";
import type { EditorState } from "../../use-editor-state";
import type { AudioActions } from "./audio-actions";

export type AudioEditing = AudioActions & {
  /** Imports files onto a track at `time`; `null` adds a track for them. */
  importAt: (files: File[], trackIndex: number | null, time: number) => Promise<void>;
  /** False when nothing was copied or pasted, so the event goes on to the editor. */
  copyKeyframes: () => boolean;
  pasteKeyframes: () => boolean;
};

/** Discrete audio edits, each one undo step, reading the latest render like the editor's own actions. */
export function useAudioActions({
  editor,
  clock,
  media,
  selection,
  store,
  select,
}: {
  editor: EditorState;
  clock: PlaybackClock;
  media: MediaImport;
  selection: AudioSelection;
  store: AudioSelectionStore;
  select: (next: AudioSelection) => void;
}): AudioEditing {
  const { project } = editor;
  const [clipboard, setClipboard] = useState<CopiedVolumeKeyframe[]>([]);
  const primaryId = primaryAudioClipId(selection);
  const primary = primaryId ? findAudioClip(project, primaryId)?.clip : undefined;
  const playhead = () => clock.getState().time;
  const commit = (next: Project) => editor.edit(() => next);
  const editClip = (clipId: string, update: Parameters<typeof updateAudioClip>[2]) =>
    commit(updateAudioClip(project, clipId, update));
  const localPlayhead = (clipId: string) => {
    const clip = findAudioClip(project, clipId)?.clip;
    return clip ? Math.min(clip.duration, Math.max(0, playhead() - clip.start)) : 0;
  };

  return {
    duplicate: () => {
      const result = duplicateAudioClips(project, selection.clipIds);
      commit(result.project);
      select({ clipIds: result.clipIds, keyframeIds: [] });
    },
    split: () =>
      commit(selection.clipIds.reduce((next, id) => splitAudioClip(next, id, playhead()), project)),
    remove: () => {
      if (selection.keyframeIds.length > 0 && primaryId) {
        editClip(primaryId, (clip) => removeVolumeKeyframes(clip, selection.keyframeIds));
        store.set({ ...selection, keyframeIds: [] });
        return;
      }
      commit(removeAudioClips(project, selection.clipIds));
      store.set(EMPTY_AUDIO_SELECTION);
    },
    toggleVolumeKeyframe: (clipId) =>
      editClip(clipId, (clip) => toggleVolumeKeyframeAt(clip, localPlayhead(clipId))),
    addVolumeKeyframe: (clipId) =>
      editClip(clipId, (clip) => addVolumeKeyframeAt(clip, localPlayhead(clipId))),
    setMuted: (trackIndex, muted) =>
      commit(updateAudioTrack(project, trackIndex, (track) => ({ ...track, muted: muted || undefined }))),
    setKeyframeEase: (clipId, keyframeIds, ease) =>
      editClip(clipId, (clip) => setVolumeKeyframeEase(clip, keyframeIds, ease)),
    deleteKeyframes: (clipId, keyframeIds) =>
      editClip(clipId, (clip) => removeVolumeKeyframes(clip, keyframeIds)),

    importAt: async (files, trackIndex, time) => {
      if (files.length === 0) return;
      const clips = await media.importAudioFiles(files);
      if (clips.length === 0) return;
      // Uploads take a while, so this edits whatever the project is by then.
      editor.edit((current) => {
        const target =
          trackIndex === null
            ? addAudioTrack(current, AUDIO_COPY.newTrackName(current.audioTracks.length + 1))
            : current;
        return placeAudioClips(target, trackIndex ?? target.audioTracks.length - 1, clips, time);
      });
      select({ clipIds: clips.map((clip) => clip.id), keyframeIds: [] });
    },
    copyKeyframes: () => {
      if (!primary || selection.keyframeIds.length === 0) return false;
      setClipboard(copyVolumeKeyframes(primary, selection.keyframeIds));
      return true;
    },
    pasteKeyframes: () => {
      if (!primary || clipboard.length === 0) return false;
      const anchor = primary.volume.keyframes.find(
        (keyframe) => keyframe.id === selection.keyframeIds.at(-1)
      );
      const at = anchor ? keyframePasteTime(anchor.at, project.settings.fps) : localPlayhead(primary.id);
      const pasted = pasteVolumeKeyframes(primary, clipboard, at);
      editClip(primary.id, () => pasted.clip);
      store.set({ clipIds: selection.clipIds, keyframeIds: pasted.keyframeIds });
      return true;
    },
  };
}
