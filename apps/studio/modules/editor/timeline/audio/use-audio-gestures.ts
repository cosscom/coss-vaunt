"use client";

import { audioClipEdges } from "@coss/vaunt-engine/audio/audio-edits";
import type { AudioClip, Keyframe, Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type * as React from "react";
import { useState } from "react";
import { AUDIO_COPY } from "../../audio/audio-copy";
import {
  type AudioSelection,
  type AudioSelectionStore,
  selectAudioClip,
  selectVolumeKeyframes,
} from "../../audio/audio-selection";
import type { PlaybackClock } from "../../player/playback-clock";
import type { EditorState } from "../../use-editor-state";
import { SNAP_DISTANCE_PX, snapTargets } from "../timeline-snapping";
import { usePointerDrag } from "../use-pointer-drag";
import { type AudioDragMode, applyAudioDrag } from "./audio-drag";

function trackIndexAt(clientX: number, clientY: number): number | null {
  const row = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-audio-track-index]");
  const index = Number(row?.dataset.audioTrackIndex);
  return Number.isInteger(index) ? index : null;
}

const isAdditive = (event: React.PointerEvent) => event.shiftKey || event.metaKey || event.ctrlKey;

/**
 * Drags on audio clips and volume keyframes. The project mid-drag is a local draft, committed as one
 * undo step on release; a press without movement is a click that selects.
 */
export function useAudioGestures({
  editor,
  clock,
  pxPerSecond,
  selection,
  store,
}: {
  editor: EditorState;
  clock: PlaybackClock;
  pxPerSecond: number;
  selection: AudioSelection;
  store: AudioSelectionStore;
}) {
  const [draft, setDraft] = useState<Project | null>(null);
  const startDrag = usePointerDrag();

  const select = (next: AudioSelection) => {
    if (editor.selection.clipIds.length > 0) editor.clearSelection();
    store.set(next);
  };

  const drag = (
    event: React.PointerEvent,
    clip: AudioClip,
    mode: AudioDragMode,
    ids: string[],
    onClick: () => void
  ) => {
    const base = editor.project;
    const originY = event.clientY;
    const originTrack = trackIndexAt(event.clientX, event.clientY) ?? 0;
    const height =
      event.currentTarget instanceof HTMLElement
        ? (event.currentTarget.closest("[data-audio-clip-id]")?.clientHeight ?? 1)
        : 1;
    const moving = new Set(mode === "move" ? ids : [clip.id]);
    const targets = [...snapTargets(base, clock.getState().time, null), ...audioClipEdges(base, moving)];
    let latest = base;
    startDrag(event, {
      onMove: ({ dx, clientX, clientY, shiftKey }) => {
        latest = applyAudioDrag(base, {
          mode,
          clipId: clip.id,
          ids,
          seconds: dx / pxPerSecond,
          heightFraction: (clientY - originY) / height,
          trackDelta: mode === "move" ? (trackIndexAt(clientX, clientY) ?? originTrack) - originTrack : 0,
          newTrackName: AUDIO_COPY.newTrackName(base.audioTracks.length + 1),
          snap: { targets, thresholdSeconds: SNAP_DISTANCE_PX / pxPerSecond, free: shiftKey },
          frameSeconds: 1 / base.settings.fps,
        });
        setDraft(latest);
      },
      onEnd: (moved) => {
        setDraft(null);
        if (!moved) onClick();
        else if (latest !== base) editor.edit(() => latest);
      },
      onCancel: () => setDraft(null),
    });
  };

  const onClipPointerDown = (event: React.PointerEvent, clip: AudioClip, mode: AudioDragMode) => {
    if (event.button !== 0) return;
    const additive = isAdditive(event);
    const selected = selection.clipIds.includes(clip.id);
    if (!additive && !selected) select(selectAudioClip(selection, clip.id, false));
    const ids =
      mode === "move" && (selected || additive) ? [...new Set([...selection.clipIds, clip.id])] : [clip.id];
    drag(event, clip, mode, ids, () => select(selectAudioClip(selection, clip.id, additive)));
  };

  const onKeyframePointerDown = (event: React.PointerEvent, clip: AudioClip, keyframe: Keyframe) => {
    if (event.button !== 0) return;
    const additive = isAdditive(event);
    const selected = selection.keyframeIds.includes(keyframe.id);
    const next =
      selected && !additive ? selection : selectVolumeKeyframes(selection, clip.id, [keyframe.id], additive);
    select(next);
    const ids = next.keyframeIds.includes(keyframe.id) ? next.keyframeIds : [keyframe.id];
    drag(event, clip, "keyframes", ids, () => {
      if (!additive) select(selectVolumeKeyframes(selection, clip.id, [keyframe.id], false));
    });
  };

  return { draft, select, onClipPointerDown, onKeyframePointerDown };
}
