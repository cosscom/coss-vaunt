import { angleAt, type BlurHandle, blurHandleAt, rangeAt } from "@coss/vaunt-engine/stage/blur-handles";
import type { LayerGeometry } from "@coss/vaunt-engine/stage/camera-projection";
import {
  type CanvasMode,
  dragProperties,
  dragTarget,
  focusAt,
  type PropertyChanges,
  resetProperties,
  ringRotation,
  wheelZoom,
} from "@coss/vaunt-engine/stage/canvas-drag";
import {
  hitRing,
  type Point,
  type RotationKey,
  ringDragDegrees,
} from "@coss/vaunt-engine/stage/rotation-gizmo";
import {
  evaluateClipProperties,
  type PropertyValues,
} from "@coss/vaunt-engine/storyboard/property-evaluation";
import type { PropertyKey } from "@coss/vaunt-engine/storyboard/property-specs";
import type { Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { activeClipsAt } from "@coss/vaunt-engine/storyboard/track-resolution";
import type * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PlaybackClock } from "../player/playback-clock";
import type { BlurGuideTarget, GizmoTarget } from "./stage-overlay";

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
  /** Which blur guide the press grabbed, when the guides show. */
  blur: { handle: BlurHandle; target: BlurGuideTarget } | null;
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
  selecting,
  pickAt,
  onPick,
  blurGuidesAt,
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
  /** The Select tool: a press selects the layer under it, then drags it like Camera mode does. */
  selecting: boolean;
  /** The clip drawn under a frame point (CSS px). */
  pickAt: (x: number, y: number) => string | null;
  onPick: (clipId: string | null, additive: boolean) => void;
  /** The blur guides on the stage, when they show: the crosshair moves the focus, the dashed edge sets the range, the dot the angle. */
  blurGuidesAt: () => BlurGuideTarget | null;
}): {
  dragging: boolean;
  activeRing: RotationKey | null;
  /** The blur guide under the pointer, when the guides show. */
  blurHandle: BlurHandle | null;
  handlers: React.HTMLAttributes<HTMLElement>;
} {
  const [dragging, setDragging] = useState(false);
  const [blurHandle, setBlurHandle] = useState<BlurHandle | null>(null);
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

  /** The blur guide under the pointer; in Focus mode a press anywhere else moves the focus too. */
  const blurUnder = (event: React.PointerEvent<HTMLElement>) => {
    const target = blurGuidesAt();
    if (!target) return null;
    const handle = blurHandleAt(target.shapes, framePoint(event)) ?? (mode === "focus" ? "focus" : null);
    // A blur that follows the cursor has no focus point of its own to move.
    if (handle === "focus" && target.settings.followCursor) return null;
    return handle ? { handle, target } : null;
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
      const blur = ring ? null : blurUnder(event);
      let found = ring
        ? { clipId: ring.target.clipId, values: ring.target.values }
        : blur
          ? { clipId: blur.target.clipId, values: blur.target.values }
          : target();
      if (selecting && !ring && !blur) {
        const additive = event.shiftKey || event.metaKey || event.ctrlKey;
        const picked = pickAt(...framePoint(event));
        onPick(picked, additive);
        if (!picked || additive) return;
        found = findTarget(latest.current.project, picked, clock.getState().time);
        // Text isn't dragged on the canvas, so the press only selects it.
        if (found?.clipId !== picked) return;
      }
      if (!found) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {
        pointerId: event.pointerId,
        clipId: found.clipId,
        start: found.values,
        x: event.clientX,
        y: event.clientY,
        ring: ring ? { ...ring, last: framePoint(event), turned: 0 } : null,
        blur,
      };
      setDragging(true);
      if (blur?.handle === "focus") focusUnder(drag.current, event);
    },
    onPointerMove(event) {
      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId) {
        if (!current) {
          setActiveRing(ringUnder(event)?.key ?? null);
          setBlurHandle(blurUnder(event)?.handle ?? null);
        }
        return;
      }
      if (current.blur && current.blur.handle !== "focus") {
        const { handle, target: blurTarget } = current.blur;
        const geometry = layerGeometry(current.clipId) ?? blurTarget.geometry;
        const [x, y] = framePoint(event);
        const changes =
          handle === "angle"
            ? angleAt(geometry, current.start, x, y)
            : rangeAt(geometry, current.start, blurTarget.settings.mode, x, y);
        if (changes) apply(current.clipId, changes, current.start);
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
      if (current.blur?.handle === "focus" || mode === "focus") {
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
      if (drag.current) return;
      setActiveRing(null);
      setBlurHandle(null);
    },
    onDoubleClick() {
      if (selecting) return;
      const found = target();
      if (found) apply(found.clipId, resetProperties(mode), found.values);
    },
  };

  return { dragging, activeRing, blurHandle, handlers };
}
