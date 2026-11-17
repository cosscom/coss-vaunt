import type { PropertyValues } from "../storyboard/property-evaluation";
import type { BlurMode, BlurSettings } from "../storyboard/storyboard-schema";
import { devicePoint, type LayerGeometry, projectToFrame, viewDepth } from "./camera-projection";

/** Blur radius at full strength, in frame heights. */
export const MAX_BLUR_RADIUS = 0.025;
/** Lens: the in-focus band at full range is this fraction of the focus distance either side of it. */
const LENS_RANGE = 0.25;
const LENS_RAMP = 0.25;
/** Radial, directional and tilt shift: the sharp area at full range reaches this many frame heights. */
const SCREEN_RANGE = 0.5;
const SCREEN_RAMP = 0.35;

const DEG = Math.PI / 180;

/** What the blur pass needs for one frame; the shader mirrors `circleOfConfusion`. */
export type DepthOfFieldParams = {
  mode: BlurMode;
  strength: number;
  /** Lens: distance in front of the camera that is sharp. */
  focusDepth: number;
  /** Half-width of the sharp band: a fraction of the focus distance for lens, frame heights otherwise. */
  inFocus: number;
  /** How far past the sharp band the blur reaches full strength, in the same units. */
  ramp: number;
  /** The projected focus point in frame fractions, y down. */
  focusPoint: [number, number];
  /** Unit direction of the blur angle in the frame, y down; 0° is horizontal. */
  direction: [number, number];
  /** Frame width over height. */
  aspect: number;
};

/**
 * Auto focus measures the focus point on the device through the device's current pose every frame, so
 * focus stays locked on it as the device turns or the camera moves. Manual focus is a fixed distance
 * from the camera, in multiples of the camera's distance to its target.
 */
export function depthOfFieldParams(
  settings: BlurSettings,
  values: Pick<PropertyValues, "blur" | "focusRange" | "focusX" | "focusY" | "focusDistance" | "blurAngle">,
  geometry: LayerGeometry
): DepthOfFieldParams {
  const point = devicePoint(geometry, values.focusX, values.focusY);
  const projected = projectToFrame(geometry, point);
  const lens = settings.mode === "lens";
  const angle = values.blurAngle * DEG;
  return {
    mode: settings.mode,
    strength: values.blur,
    focusDepth:
      settings.focus === "auto"
        ? viewDepth(geometry.rig, point)
        : values.focusDistance * geometry.rig.distance,
    inFocus: values.focusRange * (lens ? LENS_RANGE : SCREEN_RANGE),
    ramp: lens ? LENS_RAMP : SCREEN_RAMP,
    focusPoint: [projected.x / geometry.frame.width, projected.y / geometry.frame.height],
    direction: [Math.cos(angle), -Math.sin(angle)],
    aspect: geometry.frame.width / geometry.frame.height,
  };
}

/** How far a frame point is from sharp, before the band and ramp: the measure each mode blurs by. */
export function focusOffset(params: DepthOfFieldParams, x: number, y: number, depth: number): number {
  if (params.mode === "lens") return Math.abs(depth - params.focusDepth) / params.focusDepth;
  const dx = (x - params.focusPoint[0]) * params.aspect;
  const dy = y - params.focusPoint[1];
  if (params.mode === "tilt-shift") return Math.abs(-dx * params.direction[1] + dy * params.direction[0]);
  return Math.hypot(dx, dy);
}

/**
 * Blur radius at a frame point (fractions, y down) at view depth `depth`, as a fraction of the full-strength
 * radius: 0 inside the sharp band, ramping to the strength past it.
 */
export function circleOfConfusion(params: DepthOfFieldParams, x: number, y: number, depth: number): number {
  const offset = focusOffset(params, x, y, depth);
  return Math.min(1, Math.max(0, (offset - params.inFocus) / params.ramp)) * params.strength;
}
