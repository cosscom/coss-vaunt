import { applyEase, evaluateClipProperties, type PropertyValues } from "../storyboard/property-evaluation";
import { PROPERTY_KEYS, PROPERTY_SPECS } from "../storyboard/property-specs";
import type { ActiveClip } from "../storyboard/track-resolution";
import type { Size } from "./camera-rig";
import { aimPan, driftView } from "./clip-drift";
import { CLOSE_UP_FOLLOW_SECONDS, type CursorSource, cursorFocusAt, withBlurOnCursor } from "./cursor-focus";

/** One clip to draw, bottom first, with its transition folded into plain render parameters. */
export type ClipLayer = {
  active: ActiveClip;
  /** Device and camera values; during an overlap both clips share the blend of the two clips'. */
  view: PropertyValues;
  opacity: number;
  /** Texture blur for cross-blur, 0 → 1. */
  blur: number;
  scale: number;
  /** Frame fractions, y down. */
  x: number;
  y: number;
};

const ZOOM_THROUGH_OUT_SCALE = 2;
const ZOOM_THROUGH_IN_SCALE = 0.6;

/** `own` with its device and camera values eased from the outgoing clip's to the incoming clip's. */
function blendView(
  own: PropertyValues,
  from: PropertyValues,
  to: PropertyValues,
  amount: number
): PropertyValues {
  const values = { ...own };
  for (const key of PROPERTY_KEYS) {
    if (PROPERTY_SPECS[key].group !== "clip") values[key] = from[key] + (to[key] - from[key]) * amount;
  }
  return values;
}

/** Sizes a drift's focus point needs to become camera pan; without them the drift aims at the centre. */
export type LayerSizes = {
  frame: Size;
  deviceFor: (clipId: string) => Size | null;
  /** The clip's recorded cursor, for a close-up or blur that follows it. */
  cursorFor?: (clipId: string) => CursorSource | null;
};

function ownView(entry: ActiveClip, sizes: LayerSizes | undefined): PropertyValues {
  const cursor = sizes?.cursorFor?.(entry.clip.id);
  const own = withBlurOnCursor(
    entry.clip,
    evaluateClipProperties(entry.clip, entry.localTime),
    entry.localTime,
    cursor
  );
  const drift = entry.clip.drift;
  if (!drift) return own;
  const followed =
    drift.followCursor && cursor ? cursorFocusAt(cursor, entry.localTime, CLOSE_UP_FOLLOW_SECONDS) : null;
  const focus = followed ?? drift.focus;
  const device = sizes?.deviceFor(entry.clip.id);
  const aim = device && sizes ? aimPan(focus, device, sizes.frame, own.fov) : { panX: 0, panY: 0 };
  return driftView(own, drift, entry.localTime / entry.clip.duration, aim);
}

/** Folds each video clip's properties, drift and transition into what the stage draws. */
export function resolveClipLayers(active: ActiveClip[], sizes?: LayerSizes): ClipLayer[] {
  const videos = active.filter((entry) => entry.clip.source.kind !== "text");
  const resolved = videos.map((entry) => ({ entry, own: ownView(entry, sizes) }));

  return resolved.flatMap(({ entry, own }): ClipLayer[] => {
    const base = { active: entry, opacity: own.opacity, blur: 0, scale: own.scale, x: own.x, y: own.y };
    const transition = entry.transition;
    if (!transition) return [{ ...base, view: own }];
    if (transition.kind === "cut") {
      return transition.role === "outgoing" ? [] : [{ ...base, view: own }];
    }

    const partner = resolved.find(
      ({ entry: other }) =>
        other.trackIndex === entry.trackIndex &&
        other.transition !== null &&
        other.transition.role !== transition.role
    );
    const partnerValues = partner?.own ?? own;
    const [outgoing, incoming] = transition.role === "outgoing" ? [own, partnerValues] : [partnerValues, own];
    const eased = applyEase("ease-in-out", transition.progress);
    const view = blendView(own, outgoing, incoming, eased);
    const presence = entry.presence;

    switch (transition.kind) {
      case "crossfade":
        return [{ ...base, view, opacity: base.opacity * presence }];
      case "cross-blur":
        return [{ ...base, view, opacity: base.opacity * presence, blur: 1 - presence }];
      case "zoom-through": {
        const factor =
          transition.role === "outgoing"
            ? 1 + (ZOOM_THROUGH_OUT_SCALE - 1) * eased
            : ZOOM_THROUGH_IN_SCALE + (1 - ZOOM_THROUGH_IN_SCALE) * eased;
        return [{ ...base, view, opacity: base.opacity * presence, scale: base.scale * factor }];
      }
    }
    // slide
    return [{ ...base, view, x: base.x + (transition.role === "outgoing" ? -eased : 1 - eased) }];
  });
}
