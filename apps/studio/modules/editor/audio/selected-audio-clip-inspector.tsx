"use client";

import { findAudioClip, updateAudioClip } from "@calcom/product-video/audio/audio-edits";
import type { AudioClip } from "@calcom/product-video/storyboard/storyboard-schema";
import type * as React from "react";
import { type PlaybackClock, usePlaybackState } from "../player/playback-clock";
import type { EditorState } from "../use-editor-state";
import { AudioClipInspector } from "./audio-clip-inspector";
import { audioSelectionFor, primaryAudioClipId, useAudioSelection } from "./audio-selection";

/** The audio clip the timeline has selected, or null; video selection always wins. */
export function useSelectedAudioClip(editor: EditorState, clock: PlaybackClock): AudioClip | null {
  const selection = useAudioSelection(audioSelectionFor(clock));
  const id = primaryAudioClipId(selection);
  if (editor.selection.clipIds.length > 0 || !id) return null;
  return findAudioClip(editor.project, id)?.clip ?? null;
}

export function SelectedAudioClipInspector({
  clip,
  editor,
  clock,
}: {
  clip: AudioClip;
  editor: EditorState;
  clock: PlaybackClock;
}): React.ReactElement {
  const time = usePlaybackState(clock, (state) => state.time);
  return (
    <AudioClipInspector
      clip={clip}
      onChange={(next) =>
        editor.edit((project) => updateAudioClip(project, next.id, () => next), `audio:${next.id}`)
      }
      playheadTime={time}
    />
  );
}
