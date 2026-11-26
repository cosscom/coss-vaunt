"use client";

import type * as React from "react";
import { useEffect } from "react";
import { type EditorAction, GLOBAL_ACTIONS, matchShortcut } from "./editor-keymap";
import { mediaFilesFromClipboard } from "./media/clipboard-media";
import type { PlaybackClock } from "./player/playback-clock";
import type { TimelineHandle } from "./timeline/timeline-panel";
import type { EditorState } from "./use-editor-state";

/** Text fields own every key; other widgets own their plain keys (arrows, Space) but not ⌘/Ctrl combos. */
const TEXT_TARGET = "input, textarea, select, [contenteditable=''], [contenteditable='true']";
const WIDGET_TARGET =
  "[role='slider'], [role='menu'], [role='menuitem'], [role='listbox'], [role='option'], [role='dialog'], [role='separator']";
/** The storyboard canvas handles its own keys (arrows move nodes, Delete removes them); undo and redo stay global. */
const STORYBOARD_TARGET = "[data-storyboard-canvas]";
const STORYBOARD_PASSTHROUGH: EditorAction[] = ["undo", "redo"];
/** Copy and paste run from the clipboard events so the browser hands over pasted files. */
const CLIPBOARD_ACTIONS: EditorAction[] = ["copy", "paste"];

function isTyping(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TEXT_TARGET) !== null;
}

function inStoryboard(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(STORYBOARD_TARGET) !== null;
}

function ownsKey(event: KeyboardEvent): boolean {
  if (isTyping(event.target)) return true;
  const inWidget = event.target instanceof Element && event.target.closest(WIDGET_TARGET) !== null;
  return inWidget && !event.metaKey && !event.ctrlKey;
}

/** The editor's keyboard shortcuts and clipboard handling; ignored while typing in a field. */
export function useEditorShortcuts({
  editor,
  clock,
  timeline,
  onShowShortcuts,
  onToggleAgent,
}: {
  editor: EditorState;
  clock: PlaybackClock;
  timeline: React.RefObject<TimelineHandle | null>;
  onShowShortcuts: () => void;
  onToggleAgent: () => void;
}): void {
  const { project } = editor;

  const run = (action: EditorAction) => {
    const { time, duration } = clock.getState();
    const frame = 1 / project.settings.fps;
    const seek = (to: number) => {
      clock.pause();
      clock.seek(to);
    };
    const handlers: Record<EditorAction, () => void> = {
      "toggle-play": () => clock.toggle(),
      "step-back": () => seek(Math.round(time / frame) * frame - frame),
      "step-forward": () => seek(Math.round(time / frame) * frame + frame),
      "step-back-second": () => seek(time - 1),
      "step-forward-second": () => seek(time + 1),
      "go-to-start": () => seek(0),
      "go-to-end": () => seek(duration),
      "toggle-keyframe": editor.toggleLastPropertyKeyframe,
      "toggle-camera-keyframes": editor.toggleGroupKeyframes,
      "add-camera-keyframes": () => editor.addCameraKeyframes(),
      "previous-keyframe": () => editor.jumpToKeyframe(-1),
      "next-keyframe": () => editor.jumpToKeyframe(1),
      "nudge-back": () => editor.nudge(-1),
      "nudge-forward": () => editor.nudge(1),
      "delete-selection": editor.deleteSelection,
      duplicate: editor.duplicateSelection,
      split: editor.splitAtPlayhead,
      copy: () => undefined,
      paste: () => undefined,
      "select-all": () => editor.selectAllClips(),
      undo: editor.undo,
      redo: editor.redo,
      "zoom-in": () => timeline.current?.zoom("in"),
      "zoom-out": () => timeline.current?.zoom("out"),
      "zoom-to-fit": () => timeline.current?.zoom("fit"),
      "toggle-agent": onToggleAgent,
      // Settings listens for ⌘, itself, on every page.
      "open-settings": () => undefined,
      "show-shortcuts": onShowShortcuts,
    };
    handlers[action]();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = matchShortcut(event);
      if (action && GLOBAL_ACTIONS.includes(action)) {
        event.preventDefault();
        run(action);
        return;
      }
      if (ownsKey(event)) return;
      if (!action || CLIPBOARD_ACTIONS.includes(action)) return;
      if (inStoryboard(event.target) && !STORYBOARD_PASSTHROUGH.includes(action)) return;
      event.preventDefault();
      run(action);
    };
    const onCopy = (event: ClipboardEvent) => {
      if (
        isTyping(event.target) ||
        inStoryboard(event.target) ||
        (editor.selection.clipIds.length === 0 && editor.selection.keyframes.length === 0)
      )
        return;
      const url = editor.copySelection();
      if (!url) {
        event.preventDefault();
        return;
      }
      event.clipboardData?.setData("text/plain", url);
      event.preventDefault();
    };
    const onPaste = (event: ClipboardEvent) => {
      if (isTyping(event.target) || inStoryboard(event.target)) return;
      const files = mediaFilesFromClipboard(event);
      if (files.length > 0) void editor.importMediaAtPlayhead(files);
      else if (editor.canPasteKeyframes && editor.selection.keyframes.length > 0) editor.pasteKeyframes();
      else if (editor.canPaste) editor.pasteAt(clock.getState().time);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("copy", onCopy);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("paste", onPaste);
    };
  });
}
