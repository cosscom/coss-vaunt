import type { LayerGeometry } from "@calcom/product-video/stage/camera-projection";
import {
  type CanvasMode,
  dragProperties,
  dragTarget,
  focusAt,
  type PropertyChanges,
  resetProperties,
  ringRotation,
  wheelZoom,
} from "@calcom/product-video/stage/canvas-drag";
import {
  hitRing,
  type Point,
  type RotationKey,
  ringDragDegrees,
} from "@calcom/product-video/stage/rotation-gizmo";
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
import type { GizmoTarget } from "./stage-overlay";

/** Wheel events closer together than this build on each other before the project catches up. */
const WHEEL_BURST_MS = 250;

/** A ring drag turns one axis: `turned` adds up each move's degrees, so it can go past half a turn. */
type RingDrag = { key: RotationKey; target: GizmoTarget; last: Point; turned: number };
type Drag = {
  pointerId: number;
  clipId: string;
  start: PropertyValues;
  x: number;
  y: number;
  ring: RingDrag | null;
};
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
  layerGeometry,
  gizmoAt,
}: {
  element: HTMLElement | null;
  mode: CanvasMode;
  project: Project;
  clock: PlaybackClock;
  selectedClipId: string | null;
  frame: { width: number; height: number };
  onSetProperty: SetProperty;
  /** Where the stage last drew a clip; Focus mode projects the pointer onto it. */
  layerGeometry: (clipId: string) => LayerGeometry | null;
  /** The rotation gizmo on the stage, when it shows; dragging a ring turns that one axis. */
  gizmoAt: () => GizmoTarget | null;
}): { dragging: boolean; activeRing: RotationKey | null; handlers: React.HTMLAttributes<HTMLElement> } {
  const [dragging, setDragging] = useState(false);
  const [activeRing, setActiveRing] = useState<RotationKey | null>(null);
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

  const framePoint = (event: React.PointerEvent<HTMLElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return [event.clientX - bounds.left, event.clientY - bounds.top];
  };

  const ringUnder = (event: React.PointerEvent<HTMLElement>) => {
    const gizmo = gizmoAt();
    const key = gizmo ? hitRing(gizmo.gizmo, framePoint(event)) : null;
    return gizmo && key ? { key, target: gizmo } : null;
  };

  const focusUnder = (current: Drag, event: React.PointerEvent<HTMLElement>) => {
    const geometry = layerGeometry(current.clipId);
    const bounds = event.currentTarget.getBoundingClientRect();
    const changes = geometry && focusAt(geometry, event.clientX - bounds.left, event.clientY - bounds.top);
    if (changes) apply(current.clipId, changes, current.start);
  };

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
      const ring = ringUnder(event);
      const found = ring ? { clipId: ring.target.clipId, values: ring.target.values } : target();
      if (!found) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {
        pointerId: event.pointerId,
        clipId: found.clipId,
        start: found.values,
        x: event.clientX,
        y: event.clientY,
        ring: ring ? { ...ring, last: framePoint(event), turned: 0 } : null,
      };
      setDragging(true);
      if (mode === "focus") focusUnder(drag.current, event);
    },
    onPointerMove(event) {
      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId) {
        if (!current) setActiveRing(ringUnder(event)?.key ?? null);
        return;
      }
      if (current.ring) {
        const { key, target: gizmo, last } = current.ring;
        const point = framePoint(event);
        current.ring.turned += ringDragDegrees(gizmo.geometry, gizmo.values, key, last, point);
        current.ring.last = point;
        apply(current.clipId, ringRotation(key, current.start[key], current.ring.turned), current.start);
        return;
      }
      if (mode === "focus") {
        focusUnder(current, event);
        return;
      }
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
    onPointerLeave() {
      if (!drag.current) setActiveRing(null);
    },
    onDoubleClick() {
      const found = target();
      if (found) apply(found.clipId, resetProperties(mode), found.values);
    },
  };

  return { dragging, activeRing, handlers };
}
