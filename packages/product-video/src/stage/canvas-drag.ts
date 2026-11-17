import type { PropertyValues } from "../storyboard/property-evaluation";
import { PROPERTY_SPECS, type PropertyKey } from "../storyboard/property-specs";
import type { ActiveClip } from "../storyboard/track-resolution";

export type CanvasMode = "camera" | "orbit" | "rotate";

export type PropertyChanges = Partial<Record<PropertyKey, number>>;

/** Degrees of rotation for a drag across the whole frame. */
const ORBIT_DEGREES_PER_FRAME = 180;
/** Orbit drags stop at straight down or up rather than flipping over the top. */
const MAX_ELEVATION = 90;
/** Zoom doubles for this much wheel delta. */
const WHEEL_DELTA_PER_DOUBLING = 500;

const RESET_KEYS: Record<CanvasMode, PropertyKey[]> = {
  camera: ["panX", "panY", "zoom"],
  orbit: ["cameraX", "cameraY", "cameraZ"],
  rotate: ["rotateX", "rotateY", "rotateZ"],
};

function fitSpec(key: PropertyKey, value: number): number {
  const spec = PROPERTY_SPECS[key];
  const stepped = Math.round(value / spec.step) * spec.step;
  return Number(Math.min(spec.max, Math.max(spec.min, stepped)).toFixed(4));
}

function changes(entries: Array<[PropertyKey, number]>): PropertyChanges {
  return Object.fromEntries(entries.map(([key, value]) => [key, fitSpec(key, value)]));
}

/**
 * Property values for a drag of (`dx`, `dy`) CSS px since the pointer went down, from the values at
 * that moment. Camera mode grabs the device so it follows the pointer one to one at any zoom. Orbit
 * moves the camera so the scene turns towards the drag; Rotate turns the device itself. `roll`
 * turns horizontal drags into a roll, clockwise for a drag to the right.
 */
export function dragProperties({
  mode,
  start,
  dx,
  dy,
  frame,
  roll = false,
}: {
  mode: CanvasMode;
  start: PropertyValues;
  dx: number;
  dy: number;
  frame: { width: number; height: number };
  roll?: boolean;
}): PropertyChanges {
  if (mode === "camera") {
    return changes([
      ["panX", start.panX - dx / frame.width / start.zoom],
      ["panY", start.panY - dy / frame.height / start.zoom],
    ]);
  }
  const yaw = (dx / frame.width) * ORBIT_DEGREES_PER_FRAME;
  const pitch = (dy / frame.height) * ORBIT_DEGREES_PER_FRAME;
  if (mode === "orbit") {
    if (roll) return changes([["cameraZ", start.cameraZ + yaw]]);
    const elevation = Math.min(MAX_ELEVATION, Math.max(-MAX_ELEVATION, start.cameraX + pitch));
    return changes([
      ["cameraY", start.cameraY - yaw],
      ["cameraX", elevation],
    ]);
  }
  if (roll) return changes([["rotateZ", start.rotateZ - yaw]]);
  return changes([
    ["rotateY", start.rotateY + yaw],
    ["rotateX", start.rotateX + pitch],
  ]);
}

/** Wheel zoom in every mode: scrolling up (negative delta) zooms in. */
export function wheelZoom(zoom: number, deltaY: number): PropertyChanges {
  return changes([["zoom", zoom * 2 ** (-deltaY / WHEEL_DELTA_PER_DOUBLING)]]);
}

/** Double-click resets what the current mode drags. */
export function resetProperties(mode: CanvasMode): PropertyChanges {
  return changes(RESET_KEYS[mode].map((key) => [key, PROPERTY_SPECS[key].defaultValue]));
}

/** What a canvas drag edits: the selected clip when it's a visible video clip, else the topmost one. */
export function dragTarget(active: ActiveClip[], selectedClipId: string | null): ActiveClip | null {
  const videos = active.filter((entry) => entry.clip.source.kind !== "text");
  return videos.find((entry) => entry.clip.id === selectedClipId) ?? videos[videos.length - 1] ?? null;
}
