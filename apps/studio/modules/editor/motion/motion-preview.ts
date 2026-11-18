import type { MotionPlacement } from "@calcom/product-video/catalogues/motion-presets/apply-motion-preset";
import {
  type MotionPose,
  type MotionPreset,
  mirrorCubic,
  poseValue,
} from "@calcom/product-video/catalogues/motion-presets/motion-presets";
import { PROPERTY_SPECS, type PropertyKey } from "@calcom/product-video/storyboard/property-specs";
import type { CubicPoints } from "@calcom/product-video/storyboard/storyboard-schema";

const LEAD_SECONDS = 0.3;
const HOLD_SECONDS = 0.9;
const PAUSE_SECONDS = 0.4;
/** Position is a fraction of the video frame; the preview's device is about half its stage, so double it. */
const POSITION_PERCENT = 160;

type PreviewFrame = { offset: number; transform: string; opacity: number; easing: string };

function cubicBezier(points: CubicPoints): string {
  return `cubic-bezier(${points.join(", ")})`;
}

function valueOf(pose: MotionPose, key: PropertyKey): number {
  const rest = PROPERTY_SPECS[key].defaultValue;
  const offset = pose[key];
  return offset === undefined ? rest : poseValue(key, offset, rest);
}

/** A pose as CSS on the preview's device; the camera turns the opposite way to the device it circles. */
export function previewStyle(pose: MotionPose): { transform: string; opacity: number } {
  const at = (key: PropertyKey) => valueOf(pose, key);
  const transform = [
    `translate(${at("x") * POSITION_PERCENT}%, ${at("y") * POSITION_PERCENT}%)`,
    `rotateX(${at("rotateX") - at("cameraX")}deg)`,
    `rotateY(${at("rotateY") - at("cameraY")}deg)`,
    `rotateZ(${at("rotateZ")}deg)`,
    `scale(${at("scale") * at("zoom")})`,
  ].join(" ");
  return { transform, opacity: at("opacity") };
}

/** One loop of the preset on the preview device, for `Element.animate`: a beat at the start pose, in, hold, out, a beat. */
export function motionPreviewFrames(
  preset: MotionPreset,
  placement: MotionPlacement
): { frames: PreviewFrame[]; durationMs: number } {
  const start = previewStyle(placement === "out" ? {} : preset.enter);
  const rest = previewStyle({});
  const end = previewStyle(placement === "in" ? {} : (preset.exit ?? preset.enter));
  const enter = placement === "out" ? 0 : preset.seconds;
  const leave = placement === "in" ? 0 : preset.seconds;
  const total = LEAD_SECONDS + enter + HOLD_SECONDS + leave + PAUSE_SECONDS;
  const at = (seconds: number) => (LEAD_SECONDS + seconds) / total;
  const frames: PreviewFrame[] = [
    { offset: 0, ...start, easing: "linear" },
    { offset: at(0), ...start, easing: cubicBezier(preset.ease) },
    { offset: at(enter), ...rest, easing: "linear" },
    { offset: at(enter + HOLD_SECONDS), ...rest, easing: cubicBezier(mirrorCubic(preset.ease)) },
    { offset: at(enter + HOLD_SECONDS + leave), ...end, easing: "linear" },
    { offset: 1, ...end, easing: "linear" },
  ];
  return { frames, durationMs: total * 1000 };
}
