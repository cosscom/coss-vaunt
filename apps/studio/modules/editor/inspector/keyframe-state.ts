import { keyframeAt } from "@calcom/product-video/storyboard/storyboard-edits";
import type { AnimatedProperty } from "@calcom/product-video/storyboard/storyboard-schema";

/** Filled diamond at the playhead, outlined when keyed elsewhere, dim when never keyed. */
export type KeyframeState = "at-playhead" | "elsewhere" | "none";

export function keyframeState(
  property: AnimatedProperty | undefined,
  localTime: number,
  tolerance?: number
): KeyframeState {
  if (!property || property.keyframes.length === 0) return "none";
  return keyframeAt(property, localTime, tolerance) ? "at-playhead" : "elsewhere";
}
