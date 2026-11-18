"use client";

import { PROPERTY_KEYS, type PropertyKey } from "@calcom/product-video/storyboard/property-specs";
import {
  ensureVideoTrack,
  moveClip,
  moveClips,
  shiftKeyframes,
  snapToFrame,
  trimClip,
  updateClip,
} from "@calcom/product-video/storyboard/storyboard-edits";
import type { Clip, Keyframe, Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { clipEnd } from "@calcom/product-video/storyboard/track-resolution";
import type * as React from "react";
import { useRef, useState } from "react";
import type { SelectedKeyframe } from "../editor-selection";
import type { PlaybackClock } from "../player/playback-clock";
import type { EditorState } from "../use-editor-state";
import type { ClipDragMode } from "./timeline-clip";
import { CONTENT_PADDING_PX } from "./timeline-metrics";
import { SNAP_DISTANCE_PX, snapSpanStart, snapTargets, snapTime } from "./timeline-snapping";
import { type DragMove, usePointerDrag } from "./use-pointer-drag";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.timeline;

type TimelineGestureOptions = {
  editor: EditorState;
  clock: PlaybackClock;
  pxPerSecond: number;
  /** The ruler's content cell; its left edge is time 0 minus the padding. */
  contentRef: React.RefObject<HTMLDivElement | null>;
  /** The scrolled body that marquees are drawn in. */
  bodyRef: React.RefObject<HTMLDivElement | null>;
};

export type Marquee = { left: number; top: number; width: number; height: number };

const additive = (event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) =>
  event.shiftKey || event.metaKey || event.ctrlKey;

function trackIndexAt(clientX: number, clientY: number, fallback: number): number {
  for (const element of document.elementsFromPoint(clientX, clientY)) {
    if (
      element instanceof HTMLElement &&
      (element.dataset.menu === "video-lane" || element.dataset.newVideoTrack !== undefined)
    )
      return Number(element.dataset.trackIndex);
  }
  return fallback;
}

function intersects(a: DOMRect, b: { left: number; top: number; right: number; bottom: number }): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Clip moves and trims, keyframe retimes, marquee selection and ruler scrubs. Drags preview as a draft
 * project, already clamped to valid placements, and commit once on release; Escape drops the draft.
 */
export function useTimelineGestures({
  editor,
  clock,
  pxPerSecond,
  contentRef,
  bodyRef,
}: TimelineGestureOptions) {
  const [draft, setDraftState] = useState<Project | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const draftRef = useRef<Project | null>(null);
  const startDrag = usePointerDrag();
  const { project, selection } = editor;
  const { fps } = project.settings;

  const timeAt = (clientX: number) =>
    Math.max(
      0,
      (clientX - (contentRef.current?.getBoundingClientRect().left ?? 0) - CONTENT_PADDING_PX) / pxPerSecond
    );
  const snapping = (targets: number[], free: boolean) => ({
    targets,
    thresholdSeconds: SNAP_DISTANCE_PX / pxPerSecond,
    free,
  });

  const setDraft = (next: Project | null) => {
    draftRef.current = next;
    setDraftState(next);
  };

  const dragProject = (
    event: React.PointerEvent,
    compute: (move: DragMove) => Project | null,
    onClick: () => void
  ) =>
    startDrag(event, {
      onMove: (move) => {
        const next = compute(move);
        if (next) setDraft(next);
      },
      onEnd: (moved) => {
        const next = draftRef.current;
        setDraft(null);
        if (!moved) onClick();
        else if (next) editor.moveSelection(next);
      },
      onCancel: () => setDraft(null),
    });

  const onClipPointerDown = (
    event: React.PointerEvent,
    clip: Clip,
    trackIndex: number,
    mode: ClipDragMode
  ) => {
    if (event.button !== 0) return;
    if (additive(event) && mode === "move") {
      event.preventDefault();
      editor.selectClip(clip.id, { additive: true });
      return;
    }
    const group = selection.clipIds.includes(clip.id) && mode === "move" ? selection.clipIds : [clip.id];
    if (!selection.clipIds.includes(clip.id)) editor.selectClip(clip.id);
    const clickTime = timeAt(event.clientX);
    let target = trackIndex;
    dragProject(
      event,
      (move) => {
        const delta = move.dx / pxPerSecond;
        const options = snapping(snapTargets(project, clock.getState().time, clip.id), move.shiftKey);
        if (mode === "trim-start")
          return trimClip(project, clip.id, "start", snapTime(clip.start + delta, options));
        if (mode === "trim-end")
          return trimClip(project, clip.id, "end", snapTime(clipEnd(clip) + delta, options));
        target = trackIndexAt(move.clientX, move.clientY, target);
        const start = snapSpanStart(clip.start + delta, clip.duration, options);
        const base = ensureVideoTrack(project, target, copy.newTrackName(project.videoTracks.length + 1));
        if (group.length === 1) return moveClip(base, clip.id, { start, trackIndex: target });
        return moveClips(base, group, start - clip.start, target - trackIndex);
      },
      () => {
        editor.selectClip(clip.id);
        const time = clock.getState().time;
        if (time < clip.start || time > clipEnd(clip)) clock.seek(clickTime);
      }
    );
  };

  const onKeyframePointerDown = (
    event: React.PointerEvent,
    clip: Clip,
    key: PropertyKey,
    keyframe: Keyframe
  ) => {
    if (event.button !== 0) return;
    const ref: SelectedKeyframe = { clipId: clip.id, key, keyframeId: keyframe.id };
    if (additive(event)) {
      event.preventDefault();
      editor.selectKeyframes([ref], true);
      return;
    }
    const selected = selection.keyframes.filter((other) => other.clipId === clip.id);
    const group = selected.some((other) => other.keyframeId === keyframe.id) ? selected : [ref];
    if (group.length === 1) editor.selectKeyframes(group, false);
    dragProject(
      event,
      (move) => {
        const targets = [clock.getState().time, clip.start, clipEnd(clip)];
        const at = snapToFrame(
          snapTime(clip.start + keyframe.at + move.dx / pxPerSecond, snapping(targets, move.shiftKey)),
          fps
        );
        return updateClip(project, clip.id, (current) =>
          shiftKeyframes(current, group, at - clip.start - keyframe.at)
        );
      },
      () => {
        editor.selectKeyframes([ref], false);
        clock.pause();
        clock.seek(clip.start + keyframe.at);
      }
    );
  };

  const onRulerPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    clock.pause();
    clock.seek(snapToFrame(timeAt(event.clientX), fps));
    startDrag(event, {
      onMove: (move) => clock.seek(snapToFrame(timeAt(move.clientX), fps)),
      onEnd: () => undefined,
      onCancel: () => undefined,
    });
  };

  /** Starts on an empty part of a lane: a click clears the selection, a drag draws a marquee. */
  const onMarqueePointerDown = (event: React.PointerEvent, kind: "clips" | "keyframes") => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    const body = bodyRef.current;
    if (!body) return;
    const extend = additive(event);
    const originY = event.clientY;
    const baseClips = extend ? selection.clipIds : [];
    const baseKeyframes = extend ? selection.keyframes : [];
    startDrag(event, {
      onMove: (move) => {
        const originX = move.clientX - move.dx;
        const rect = {
          left: Math.min(originX, move.clientX),
          right: Math.max(originX, move.clientX),
          top: Math.min(originY, move.clientY),
          bottom: Math.max(originY, move.clientY),
        };
        const bodyRect = body.getBoundingClientRect();
        setMarquee({
          left: rect.left - bodyRect.left,
          top: rect.top - bodyRect.top,
          width: rect.right - rect.left,
          height: rect.bottom - rect.top,
        });
        const hits = [
          ...body.querySelectorAll<HTMLElement>(
            kind === "clips" ? "[data-menu=clip]" : "[data-menu=keyframe]"
          ),
        ]
          .filter((element) => intersects(element.getBoundingClientRect(), rect))
          .map((element) => element.dataset);
        if (kind === "clips") {
          editor.selectClips(
            [...new Set([...baseClips, ...hits.flatMap((data) => data.clipId ?? [])])],
            false
          );
          return;
        }
        const refs = hits.flatMap((data) => {
          const key = PROPERTY_KEYS.find((candidate) => candidate === data.key);
          return data.clipId && key && data.keyframeId
            ? [{ clipId: data.clipId, key, keyframeId: data.keyframeId }]
            : [];
        });
        const fresh = refs.filter(
          (ref) => !baseKeyframes.some((other) => other.keyframeId === ref.keyframeId)
        );
        if (baseKeyframes.length + fresh.length > 0)
          editor.selectKeyframes([...baseKeyframes, ...fresh], false);
      },
      onEnd: (moved) => {
        setMarquee(null);
        if (!moved && !extend) editor.clearSelection();
      },
      onCancel: () => setMarquee(null),
    });
  };

  return {
    draft,
    marquee,
    timeAt,
    onClipPointerDown,
    onKeyframePointerDown,
    onRulerPointerDown,
    onMarqueePointerDown,
  };
}
