"use client";

import { findAudioClip } from "@calcom/product-video/audio/audio-edits";
import { ACCEPTED_AUDIO } from "@calcom/product-video/imports/media-types";
import type * as React from "react";
import { useEffect, useRef } from "react";
import {
  audioSelectionFor,
  EMPTY_AUDIO_SELECTION,
  primaryAudioClipId,
  pruneAudioSelection,
  useAudioSelection,
} from "../../audio/audio-selection";
import { useAudioPlayback } from "../../audio/use-audio-playback";
import { audioFilesFromDrop } from "../../media/clipboard-media";
import { useMediaImport } from "../../media/use-media-import";
import type { PlaybackClock } from "../../player/playback-clock";
import type { EditorState } from "../../use-editor-state";
import { AudioTrackRow } from "../audio-track-row";
import { AddAudioTrackRow } from "./add-audio-track-row";
import { AudioVolumeLane } from "./audio-volume-lane";
import { useAudioActions } from "./use-audio-actions";
import { useAudioGestures } from "./use-audio-gestures";
import { useAudioShortcuts } from "./use-audio-shortcuts";

type AudioTracksProps = {
  editor: EditorState;
  clock: PlaybackClock;
  contentWidth: number;
  pxPerSecond: number;
  toX: (seconds: number) => number;
};

/**
 * Every audio track, the selected clip's volume lane and audio playback. Owns its own selection and
 * shortcuts while audio is selected, since the editor's selection covers video clips only.
 */
export function AudioTracks({
  editor,
  clock,
  contentWidth,
  pxPerSecond,
  toX,
}: AudioTracksProps): React.ReactElement {
  const { project } = editor;
  const store = audioSelectionFor(clock);
  const selection = pruneAudioSelection(useAudioSelection(store), project);
  const gestures = useAudioGestures({ editor, clock, pxPerSecond, selection, store });
  const media = useMediaImport(project.id);
  const editing = useAudioActions({ editor, clock, media, selection, store, select: gestures.select });
  const importTrack = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const view = gestures.draft ?? project;
  const primaryId = primaryAudioClipId(selection);
  const primary = primaryId ? findAudioClip(view, primaryId) : null;
  const selectedClipIds = new Set(selection.clipIds);

  useAudioPlayback(project.audioTracks, clock, project.id);
  useAudioShortcuts({ active: selection.clipIds.length > 0, primaryClipId: primaryId, editing });

  const videoSelected = editor.selection.clipIds.length > 0;
  useEffect(() => {
    if (videoSelected) store.set(EMPTY_AUDIO_SELECTION);
  }, [videoSelected, store]);

  return (
    <div
      className="[--studio-audio-line:oklch(0.42_0.2_295)] [--studio-audio:oklch(0.62_0.17_295)] dark:[--studio-audio-line:oklch(0.86_0.09_295)] dark:[--studio-audio:oklch(0.7_0.15_295)]"
      data-testid="audio-tracks">
      <input
        accept={ACCEPTED_AUDIO}
        className="hidden"
        data-testid="audio-file-input"
        multiple
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          void editing.importAt(files, importTrack.current, clock.getState().time);
        }}
        ref={fileInputRef}
        type="file"
      />
      {view.audioTracks.map((track, trackIndex) => (
        <div key={track.id}>
          <AudioTrackRow
            actions={editing}
            clock={clock}
            contentWidth={contentWidth}
            onClearSelection={() => store.set(EMPTY_AUDIO_SELECTION)}
            onClipPointerDown={gestures.onClipPointerDown}
            onDropFiles={(dataTransfer, time) =>
              void editing.importAt(audioFilesFromDrop(dataTransfer), trackIndex, time)
            }
            onImport={() => {
              importTrack.current = trackIndex;
              fileInputRef.current?.click();
            }}
            onSelectClip={(clipId) => gestures.select({ clipIds: [clipId], keyframeIds: [] })}
            projectId={project.id}
            pxPerSecond={pxPerSecond}
            selectedClipIds={selectedClipIds}
            toX={toX}
            track={track}
            trackIndex={trackIndex}
          />
          {primary?.trackIndex === trackIndex ? (
            <AudioVolumeLane
              actions={editing}
              clip={primary.clip}
              clock={clock}
              contentWidth={contentWidth}
              onKeyframePointerDown={(event, keyframe) =>
                gestures.onKeyframePointerDown(event, primary.clip, keyframe)
              }
              selectedKeyframeIds={new Set(selection.keyframeIds)}
              toX={toX}
            />
          ) : null}
        </div>
      ))}
      {view.audioTracks.length === 0 ? (
        <AddAudioTrackRow
          contentWidth={contentWidth}
          onDrop={(dataTransfer, time) => void editing.importAt(audioFilesFromDrop(dataTransfer), null, time)}
          pxPerSecond={pxPerSecond}
          toX={toX}
        />
      ) : null}
    </div>
  );
}
