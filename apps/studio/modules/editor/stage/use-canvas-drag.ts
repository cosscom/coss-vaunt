import {
  type CanvasMode,
  dragProperties,
  dragTarget,
  type PropertyChanges,
  resetProperties,
  wheelZoom,
} from "@calcom/product-video/stage/canvas-drag";
import {
  evaluateClipProperties,
  type PropertyValues,
} from "@calcom/product-video/storyboard/property-evaluation";
import type { PropertyKey } from "@calcom/product-video/storyboard/property-specs";
import type { Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { activeClipsAt } from "@calcom/product-video/storyboard/track-resolution";
import type * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PlaybackClock } from "../player/playback-clock";

/** Wheel events closer together than this build on each other before the project catches up. */
const WHEEL_BURST_MS = 250;

type Drag = { pointerId: number; clipId: string; start: PropertyValues; x: number; y: number };
type SetProperty = (clipId: string, key: PropertyKey, value: number) => void;

function findTarget(
  project: Project,
  selectedClipId: string | null,
  time: number
): { clipId: string; values: PropertyValues } | null {
  const entry = dragTarget(activeClipsAt(project, time), selectedClipId);
  return entry
    ? { clipId: entry.clip.id, values: evaluateClipProperties(entry.clip, entry.localTime) }
    : null;
}

/** Only changed keys are set, so a horizontal drag doesn't key rotate X at the playhead. */
function applyChanges(
  set: SetProperty,
  clipId: string,
  changes: PropertyChanges,
  from: PropertyValues
): void {
  for (const [key, value] of Object.entries(changes) as Array<[PropertyKey, number]>) {
    if (value !== from[key]) set(clipId, key, value);
  }
}

/**
 * Pointer handlers for the stage frame: drags and the wheel edit the clip under the canvas through
 * `onSetProperty`, at the playhead, like the inspector does.
 */
export function useCanvasDrag({
  element,
  mode,
  project,
  clock,
  selectedClipId,
  frame,
  onSetProperty,
}: {
  element: HTMLElement | null;
  mode: CanvasMode;
  project: Project;
  clock: PlaybackClock;
  selectedClipId: string | null;
  frame: { width: number; height: number };
  onSetProperty: SetProperty;
}): { dragging: boolean; handlers: React.HTMLAttributes<HTMLElement> } {
  const [dragging, setDragging] = useState(false);
  const drag = useRef<Drag | null>(null);
  const latest = useRef({ project, selectedClipId, frame, onSetProperty });
  useLayoutEffect(() => {
    latest.current = { project, selectedClipId, frame, onSetProperty };
  });

  const target = () => {
    const { project: current, selectedClipId: selected } = latest.current;
    return findTarget(current, selected, clock.getState().time);
  };

  const apply = (clipId: string, changes: PropertyChanges, from: PropertyValues) =>
    applyChanges(latest.current.onSetProperty, clipId, changes, from);

  useEffect(() => {
    if (!element) return;
    let burst: { clipId: string; zoom: number; at: number } | null = null;
    const onWheel = (event: WheelEvent) => {
      const { project: current, selectedClipId: selected, onSetProperty: set } = latest.current;
      const found = findTarget(current, selected, clock.getState().time);
      if (!found) return;
      event.preventDefault();
      const now = performance.now();
      const zoom =
        burst && burst.clipId === found.clipId && now - burst.at < WHEEL_BURST_MS
          ? burst.zoom
          : found.values.zoom;
      const changes = wheelZoom(zoom, event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY);
      burst = { clipId: found.clipId, zoom: changes.zoom ?? zoom, at: now };
      applyChanges(set, found.clipId, changes, { ...found.values, zoom });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [element, clock]);

  const handlers: React.HTMLAttributes<HTMLElement> = {
    onPointerDown(event) {
      if (event.button !== 0) return;
      const found = target();
      if (!found) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {
        pointerId: event.pointerId,
        clipId: found.clipId,
        start: found.values,
        x: event.clientX,
        y: event.clientY,
      };
      setDragging(true);
    },
    onPointerMove(event) {
      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId) return;
      apply(
        current.clipId,
        dragProperties({
          mode,
          start: current.start,
          dx: event.clientX - current.x,
          dy: event.clientY - current.y,
          frame: latest.current.frame,
          roll: event.altKey,
        }),
        current.start
      );
    },
    onPointerUp(event) {
      if (drag.current?.pointerId !== event.pointerId) return;
      drag.current = null;
      setDragging(false);
    },
    onPointerCancel() {
      drag.current = null;
      setDragging(false);
    },
    onDoubleClick() {
      const found = target();
      if (found) apply(found.clipId, resetProperties(mode), found.values);
    },
  };

  return { dragging, handlers };
}
