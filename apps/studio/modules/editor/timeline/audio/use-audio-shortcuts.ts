"use client";

import { useEffect } from "react";
import { type EditorAction, matchShortcut } from "../../editor-keymap";
import type { AudioEditing } from "./use-audio-actions";

const TEXT_TARGET = "input, textarea, select, [contenteditable=''], [contenteditable='true']";
const isTyping = (target: EventTarget | null) =>
  target instanceof Element && target.closest(TEXT_TARGET) !== null;

/**
 * The editor's Delete, ⌘D, S, K, ⌘C and ⌘V, applied to the audio selection while there is one. They
 * listen in the capture phase and stop there, so the editor's own handlers don't also act on video.
 */
export function useAudioShortcuts({
  active,
  primaryClipId,
  editing,
}: {
  active: boolean;
  primaryClipId: string | null;
  editing: AudioEditing;
}): void {
  useEffect(() => {
    if (!active) return;
    const handlers: Partial<Record<EditorAction, () => void>> = {
      "delete-selection": editing.remove,
      duplicate: editing.duplicate,
      split: editing.split,
      "toggle-keyframe": () => {
        if (primaryClipId) editing.toggleVolumeKeyframe(primaryClipId);
      },
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const action = matchShortcut(event);
      const handler = action ? handlers[action] : undefined;
      if (!handler) return;
      event.preventDefault();
      event.stopPropagation();
      handler();
    };
    const clipboard = (handle: () => boolean) => (event: ClipboardEvent) => {
      if (isTyping(event.target) || !handle()) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const onCopy = clipboard(editing.copyKeyframes);
    const onPaste = clipboard(editing.pasteKeyframes);
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("copy", onCopy, { capture: true });
    window.addEventListener("paste", onPaste, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("copy", onCopy, { capture: true });
      window.removeEventListener("paste", onPaste, { capture: true });
    };
  });
}
