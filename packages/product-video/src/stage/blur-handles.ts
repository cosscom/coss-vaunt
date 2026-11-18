import type { PropertyValues } from "../storyboard/property-evaluation";
import { PROPERTY_SPECS } from "../storyboard/property-specs";
import type { BlurMode } from "../storyboard/storyboard-schema";
import type { BlurGuideShapes, Point } from "./blur-guides";
import { frameToDevice, type LayerGeometry } from "./camera-projection";
import type { PropertyChanges } from "./canvas-drag";
import { SCREEN_RANGE, surfacePoint } from "./depth-of-field";

/** What a press on the blur guides grabs: the angle dot, the sharp area's dashed edge, or the focus point. */
export type BlurHandle = "angle" | "range" | "focus";

/** How close, in CSS px, the pointer must be to grab the angle dot or the dashed edge. */
const GRAB_PX = 8;

function distanceToSegment([px, py]: Point, [ax, ay]: Point, [bx, by]: Point): number {
  const [dx, dy] = [bx - ax, by - ay];
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** The guide under a frame point, or null when the press misses them all. */
export function blurHandleAt(shapes: BlurGuideShapes, point: Point): BlurHandle | null {
  const near = (target: Point | null, reach: number) =>
    target !== null && Math.hypot(point[0] - target[0], point[1] - target[1]) <= reach;
  if (near(shapes.angleHandle, GRAB_PX)) return "angle";
  // The focus crosshair is drawn with a 13 px reach.
  if (near(shapes.focusPoint, GRAB_PX * 1.6)) return "focus";
  const falloff = shapes.falloff;
  for (const edge of falloff?.edges ?? []) {
    const closed = falloff?.shape === "circle";
    const segments = closed ? edge.length : edge.length - 1;
    for (let index = 0; index < segments; index++) {
      const next = edge[(index + 1) % edge.length];
      if (next && distanceToSegment(point, edge[index], next) <= GRAB_PX) return "range";
    }
  }
  return null;
}

function round(key: "focusRange" | "blurAngle", value: number): number {
  const spec = PROPERTY_SPECS[key];
  const stepped = Math.round(value / spec.step) * spec.step;
  return Number(Math.min(spec.max, Math.max(spec.min, stepped)).toFixed(4));
}

/** The pointer and the focus on the device's surface, in device heights; null when the pointer misses its plane. */
function onSurface(
  geometry: LayerGeometry,
  values: Pick<PropertyValues, "focusX" | "focusY">,
  x: number,
  y: number
): { pointer: Point; focus: Point } | null {
  const hit = frameToDevice(geometry, x, y);
  if (!hit) return null;
  return {
    pointer: surfacePoint(geometry, ...hit),
    focus: surfacePoint(geometry, values.focusX, values.focusY),
  };
}

/** Dragging the dashed edge: the sharp area reaches the pointer, measured on the device. */
export function rangeAt(
  geometry: LayerGeometry,
  values: Pick<PropertyValues, "focusX" | "focusY" | "blurAngle">,
  mode: BlurMode,
  x: number,
  y: number
): PropertyChanges | null {
  const found = onSurface(geometry, values, x, y);
  if (!found || mode === "lens") return null;
  const [dx, dy] = [found.pointer[0] - found.focus[0], found.pointer[1] - found.focus[1]];
  const angle = (values.blurAngle * Math.PI) / 180;
  const distance =
    mode === "tilt-shift" ? Math.abs(-dx * -Math.sin(angle) + dy * Math.cos(angle)) : Math.hypot(dx, dy);
  return { focusRange: round("focusRange", distance / SCREEN_RANGE) };
}

/** Dragging the angle dot: the blur runs from the focus towards the pointer, on the device. */
export function angleAt(
  geometry: LayerGeometry,
  values: Pick<PropertyValues, "focusX" | "focusY">,
  x: number,
  y: number
): PropertyChanges | null {
  const found = onSurface(geometry, values, x, y);
  if (!found) return null;
  const [dx, dy] = [found.pointer[0] - found.focus[0], found.pointer[1] - found.focus[1]];
  if (Math.hypot(dx, dy) < 1e-6) return null;
  return { blurAngle: round("blurAngle", (Math.atan2(-dy, dx) * 180) / Math.PI) };
}
