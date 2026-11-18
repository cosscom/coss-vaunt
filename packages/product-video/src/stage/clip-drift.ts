import type { PropertyValues } from "../storyboard/property-evaluation";
import type { Drift } from "../storyboard/storyboard-schema";
import { fitFrameWorldSize, type Size } from "./camera-rig";

/** On-screen travel across the whole clip at full intensity, as a fraction of the frame. */
const SLIDE_TRAVEL = 0.3;
/** Degrees the media turns across the whole clip at full intensity. */
const TILT_TRAVEL = 24;

const DIRECTIONS: Record<Drift["direction"], [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

/** Camera pan that centres `focus` (fractions of the device's half-size, y down) in the frame. */
export function aimPan(
  focus: Drift["focus"],
  device: Size,
  frame: Size,
  fov: number
): { panX: number; panY: number } {
  const fit = fitFrameWorldSize(device, frame, fov);
  return {
    panX: (focus.x * device.width) / 2 / fit.width,
    panY: (focus.y * device.height) / 2 / fit.height,
  };
}

/**
 * The clip's view with its drift on top: zoomed in on the focus point, and travelling steadily in the drift's
 * direction so it passes through the focus point halfway through the clip. `progress` runs 0 → 1 over the clip.
 */
export function driftView(
  view: PropertyValues,
  drift: Drift,
  progress: number,
  aim: { panX: number; panY: number }
): PropertyValues {
  const along = Math.min(1, Math.max(0, progress)) - 0.5;
  const [dx, dy] = DIRECTIONS[drift.direction];
  const zoom = view.zoom * drift.zoom;
  const next = { ...view, zoom, panX: view.panX + aim.panX, panY: view.panY + aim.panY };
  if (drift.motion === "slide" || drift.motion === "slide-tilt") {
    // The camera moves against the media's travel; pan is in zoom-1 frames, so divide to keep screen speed.
    const travel = (SLIDE_TRAVEL * drift.intensity * along) / zoom;
    next.panX -= dx * travel;
    next.panY -= dy * travel;
  }
  if (drift.motion === "tilt" || drift.motion === "slide-tilt") {
    const turn = TILT_TRAVEL * drift.intensity * along;
    next.rotateY += dx * turn;
    next.rotateX -= dy * turn;
  }
  return next;
}
