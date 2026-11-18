import { evaluateProperty } from "../../storyboard/property-evaluation";
import { PROPERTY_SPECS, type PropertyKey } from "../../storyboard/property-specs";
import type { AnimatedProperty, Clip, Keyframe } from "../../storyboard/storyboard-schema";
import { type MotionPose, type MotionPreset, mirrorCubic, poseValue } from "./motion-presets";

export const MOTION_PLACEMENTS = ["in", "out", "both"] as const;
export type MotionPlacement = (typeof MOTION_PLACEMENTS)[number];

/** With both ends animated, each takes at most this share of the clip, so they never meet. */
const SHARED_SHARE = 0.45;
const EPSILON = 1e-6;

function clamp(key: PropertyKey, value: number): number {
  const spec = PROPERTY_SPECS[key];
  return Math.min(spec.max, Math.max(spec.min, value));
}

function propertyOf(clip: Clip, key: PropertyKey): AnimatedProperty {
  return clip.properties[key] ?? { value: PROPERTY_SPECS[key].defaultValue, keyframes: [] };
}

type Window = { from: number; to: number; pose: MotionPose; atStart: boolean };

/**
 * Keys a preset onto a clip: the entrance moves from the preset's pose into the clip's own pose over its first
 * seconds, the exit back out over its last. Keyframes already inside those windows, on the preset's properties,
 * are replaced; the rest of the clip's animation is kept, and its pose at each window's inner edge is the rest pose.
 */
export function applyMotionPreset(
  clip: Clip,
  preset: MotionPreset,
  placement: MotionPlacement,
  newId: () => string = () => crypto.randomUUID()
): Clip {
  const seconds = Math.min(
    preset.seconds,
    placement === "both" ? clip.duration * SHARED_SHARE : clip.duration
  );
  const windows: Window[] = [];
  if (placement !== "out") windows.push({ from: 0, to: seconds, pose: preset.enter, atStart: true });
  if (placement !== "in")
    windows.push({
      from: clip.duration - seconds,
      to: clip.duration,
      pose: preset.exit ?? preset.enter,
      atStart: false,
    });

  const keys = [...new Set(windows.flatMap((window) => Object.keys(window.pose) as PropertyKey[]))];
  const properties = { ...clip.properties };
  for (const key of keys) {
    const original = propertyOf(clip, key);
    let keyframes = original.keyframes;
    const added: Keyframe[] = [];
    for (const window of windows) {
      const offset = window.pose[key];
      if (offset === undefined) continue;
      const inner = window.atStart ? window.to : window.from;
      const rest = evaluateProperty(original, inner);
      const posed = clamp(key, poseValue(key, offset, rest));
      keyframes = keyframes.filter((k) => k.at < window.from - EPSILON || k.at > window.to + EPSILON);
      if (window.atStart) {
        added.push({ id: newId(), at: window.from, value: posed, ease: "linear" });
        added.push({ id: newId(), at: window.to, value: rest, ease: { cubic: preset.ease } });
      } else {
        added.push({ id: newId(), at: window.from, value: rest, ease: "ease-in-out" });
        added.push({ id: newId(), at: window.to, value: posed, ease: { cubic: mirrorCubic(preset.ease) } });
      }
    }
    properties[key] = {
      value: original.value,
      keyframes: [...keyframes, ...added].sort((a, b) => a.at - b.at),
    };
  }
  return { ...clip, properties };
}

/** The properties a preset keys, so their lanes can be shown after it lands. */
export function motionPresetKeys(preset: MotionPreset): PropertyKey[] {
  return [...new Set([...Object.keys(preset.enter), ...Object.keys(preset.exit ?? {})])] as PropertyKey[];
}
