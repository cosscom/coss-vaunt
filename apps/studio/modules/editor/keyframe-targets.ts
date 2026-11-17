import { PROPERTY_SPECS, type PropertyKey } from "@calcom/product-video/storyboard/property-specs";
import { keysInGroup } from "./timeline/keyframed-properties";

/** K: the selected lanes exactly, else the property edited last. */
export function keyframeTargetKeys(
  selectedLanes: readonly PropertyKey[],
  lastProperty: PropertyKey | null
): PropertyKey[] {
  if (selectedLanes.length > 0) return [...selectedLanes];
  return lastProperty ? [lastProperty] : [];
}

/** Shift+K: the whole group of the property edited last, the camera when nothing was edited. */
export function groupTargetKeys(lastProperty: PropertyKey | null): PropertyKey[] {
  return keysInGroup(lastProperty ? PROPERTY_SPECS[lastProperty].group : "camera");
}
