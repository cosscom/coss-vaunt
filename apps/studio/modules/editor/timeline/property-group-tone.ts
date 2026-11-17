import type { PropertyGroup } from "@calcom/product-video/storyboard/property-specs";

/** Each group's lanes get a tone, so "Rotation Y" and "Camera Y" never read alike; audio has purple. */
export const PROPERTY_GROUP_TONE: Record<PropertyGroup, { dot: string; gutter: string }> = {
  device: { dot: "bg-info", gutter: "bg-info/8" },
  camera: { dot: "bg-warning", gutter: "bg-warning/8" },
  blur: { dot: "bg-pink-500", gutter: "bg-pink-500/8" },
  clip: { dot: "bg-success", gutter: "bg-success/8" },
};
