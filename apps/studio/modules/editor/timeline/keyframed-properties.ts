import {
  PROPERTY_KEYS,
  PROPERTY_SPECS,
  type PropertyGroup,
  type PropertyKey,
} from "@coss/vaunt-engine/storyboard/property-specs";
import type { Clip, Keyframe } from "@coss/vaunt-engine/storyboard/storyboard-schema";

export type KeyframedProperty = { key: PropertyKey; keyframes: Keyframe[] };

/** Properties with at least one keyframe, in inspector order, optionally limited to one group. */
export function keyframedProperties(
  clip: Pick<Clip, "properties">,
  group?: PropertyGroup
): KeyframedProperty[] {
  return PROPERTY_KEYS.flatMap((key) => {
    const keyframes = clip.properties[key]?.keyframes ?? [];
    if (keyframes.length === 0 || (group && PROPERTY_SPECS[key].group !== group)) return [];
    return [{ key, keyframes }];
  });
}

export function keyframeCount(clip: Pick<Clip, "properties">, group?: PropertyGroup): number {
  return keyframedProperties(clip, group).reduce((count, property) => count + property.keyframes.length, 0);
}

/** Keyframed properties plus any lanes the author opened before keying them, in inspector order. */
export function laneProperties(
  clip: Pick<Clip, "properties">,
  shown: readonly PropertyKey[]
): KeyframedProperty[] {
  return PROPERTY_KEYS.flatMap((key) => {
    const keyframes = clip.properties[key]?.keyframes ?? [];
    return keyframes.length > 0 || shown.includes(key) ? [{ key, keyframes }] : [];
  });
}

export const PROPERTY_GROUP_ORDER: PropertyGroup[] = ["device", "camera", "blur", "clip"];

export function keysInGroup(group: PropertyGroup): PropertyKey[] {
  return PROPERTY_KEYS.filter((key) => PROPERTY_SPECS[key].group === group);
}
