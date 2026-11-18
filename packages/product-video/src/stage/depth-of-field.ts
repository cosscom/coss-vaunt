import type { PropertyValues } from "../storyboard/property-evaluation";
import type { BlurMode, BlurSettings } from "../storyboard/storyboard-schema";
import { devicePoint, type LayerGeometry, projectToFrame, viewDepth } from "./camera-projection";
import { applyHomography, fitHomography, type Homography } from "./homography";

/** Blur radius at full strength, in frame heights. */
export const MAX_BLUR_RADIUS = 0.025;
/** Lens: the in-focus band at full range is this fraction of the focus distance either side of it. */
const LENS_RANGE = 0.25;
const LENS_RAMP = 0.25;
/** Radial, directional and tilt shift: the sharp area at full range reaches this many device heights. */
export const SCREEN_RANGE = 0.5;
const SCREEN_RAMP = 0.35;

const DEG = Math.PI / 180;

/** What the blur pass needs for one frame; the shader mirrors `circleOfConfusion`. */
export type DepthOfFieldParams = {
  mode: BlurMode;
  strength: number;
  /** Lens: distance in front of the camera that is sharp. */
  focusDepth: number;
  /** Half-width of the sharp band: a fraction of the focus distance for lens, device heights otherwise. */
  inFocus: number;
  /** How far past the sharp band the blur reaches full strength, in the same units. */
  ramp: number;
  /** The blur angle's direction on the device, drawn into the frame at the focus point: unit, y down. */
  direction: [number, number];
  /** Maps frame fractions (y down) onto the device's plane in device heights from its centre (y down); null edge-on. */
  toSurface: Homography | null;
  /** The focus point on the device, in the same units. */
  surfaceFocus: [number, number];
  /** The blur angle on the device, unit; 0° runs along the device's width. */
  surfaceDirection: [number, number];
};

/** Device corners in device fractions, and the same corners in device heights from the centre. */
const CORNERS: Array<[number, number]> = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/** A point on the device in device fractions, in device heights from its centre (y down). */
export function surfacePoint(
  geometry: Pick<LayerGeometry, "device">,
  x: number,
  y: number
): [number, number] {
  return [(x * geometry.device.width) / geometry.device.height / 2, y / 2];
}

/** A point in device heights from the centre, back in device fractions. */
export function surfaceToDevice(
  geometry: Pick<LayerGeometry, "device">,
  [x, y]: [number, number]
): [number, number] {
  return [(x * 2 * geometry.device.height) / geometry.device.width, y * 2];
}

function frameFraction(geometry: LayerGeometry, x: number, y: number): [number, number] {
  const point = projectToFrame(geometry, devicePoint(geometry, x, y));
  return [point.x / geometry.frame.width, point.y / geometry.frame.height];
}

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
  const surfaceDirection: [number, number] = [Math.cos(angle), -Math.sin(angle)];
  const surfaceFocus = surfacePoint(geometry, values.focusX, values.focusY);
  const fitted = fitHomography(
    CORNERS.map(([x, y]) => frameFraction(geometry, x, y)),
    CORNERS.map(([x, y]) => surfacePoint(geometry, x, y))
  );
  const focusFraction: [number, number] = [
    projected.x / geometry.frame.width,
    projected.y / geometry.frame.height,
  ];
  // The map is only fixed up to sign; flip it so the visible side of the plane, where the focus is, has w > 0.
  const toSurface =
    fitted && applyHomography(fitted, focusFraction).w < 0
      ? (fitted.map((entry) => -entry) as Homography)
      : fitted;
  // A short step along the angle on the device, seen in the frame, gives the streak's direction there.
  const step = surfaceToDevice(geometry, [
    surfaceFocus[0] + surfaceDirection[0] * 0.05,
    surfaceFocus[1] + surfaceDirection[1] * 0.05,
  ]);
  const ahead = projectToFrame(geometry, devicePoint(geometry, ...step));
  const [dx, dy] = [ahead.x - projected.x, ahead.y - projected.y];
  const length = Math.hypot(dx, dy);
  return {
    mode: settings.mode,
    strength: values.blur,
    focusDepth:
      settings.focus === "auto"
        ? viewDepth(geometry.rig, point)
        : values.focusDistance * geometry.rig.distance,
    inFocus: values.focusRange * (lens ? LENS_RANGE : SCREEN_RANGE),
    ramp: lens ? LENS_RAMP : SCREEN_RAMP,
    direction: length > 1e-6 ? [dx / length, dy / length] : surfaceDirection,
    toSurface,
    surfaceFocus,
    surfaceDirection,
  };
}

/** How far a frame point is from sharp, before the band and ramp: the measure each mode blurs by. */
export function focusOffset(params: DepthOfFieldParams, x: number, y: number, depth: number): number {
  if (params.mode === "lens") return Math.abs(depth - params.focusDepth) / params.focusDepth;
  if (!params.toSurface) return Number.POSITIVE_INFINITY;
  const surface = applyHomography(params.toSurface, [x, y]);
  // Past the plane's horizon there is no device to measure on.
  if (surface.w <= 0) return Number.POSITIVE_INFINITY;
  const dx = surface.x - params.surfaceFocus[0];
  const dy = surface.y - params.surfaceFocus[1];
  const [ax, ay] = params.surfaceDirection;
  if (params.mode === "tilt-shift") return Math.abs(-dx * ay + dy * ax);
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
