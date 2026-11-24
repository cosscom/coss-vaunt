import type { PropertyGroup } from "@coss/vaunt-engine/storyboard/property-specs";

/** Each group's lanes get a tone, so "Rotation Y" and "Camera Y" never read alike. */
export const PROPERTY_GROUP_TONE: Record<PropertyGroup, { dot: string; gutter: string }> = {
  device: { dot: "bg-info", gutter: "bg-info/8" },
  camera: { dot: "bg-warning", gutter: "bg-warning/8" },
  blur: { dot: "bg-violet-500", gutter: "bg-violet-500/8" },
  clip: { dot: "bg-success", gutter: "bg-success/8" },
};
