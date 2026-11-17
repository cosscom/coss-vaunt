import { applyEase, evaluateClipProperties } from "@calcom/product-video/storyboard/property-evaluation";
import type { ActiveClip } from "@calcom/product-video/storyboard/track-resolution";

/** Where a text clip sits in the frame, with its transition folded in; x and y are frame fractions, y down. */
export type TextClipPlacement = { opacity: number; scale: number; x: number; y: number };

/** Mirrors the stage's transition rules so text and footage on one track blend the same way. */
export function textClipPlacement(active: ActiveClip): TextClipPlacement {
  const own = evaluateClipProperties(active.clip, active.localTime);
  const base = { opacity: own.opacity, scale: own.scale, x: own.x, y: own.y };
  const transition = active.transition;
  if (!transition) return base;
  switch (transition.kind) {
    case "cut":
      return transition.role === "outgoing" ? { ...base, opacity: 0 } : base;
    case "slide": {
      const eased = applyEase("ease-in-out", transition.progress);
      return { ...base, x: base.x + (transition.role === "outgoing" ? -eased : 1 - eased) };
    }
    case "crossfade":
    case "cross-blur":
    case "zoom-through":
      return { ...base, opacity: base.opacity * active.presence };
  }
}
