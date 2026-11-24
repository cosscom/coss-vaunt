import type { PropertyKey, PropertySpec } from "@coss/vaunt-engine/storyboard/property-specs";

const FORMATS: Record<PropertySpec["unit"], Intl.NumberFormatOptions> = {
  deg: { style: "unit", unit: "degree", unitDisplay: "narrow", maximumFractionDigits: 1 },
  x: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  fraction: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  percent: { style: "percent", maximumFractionDigits: 0 },
  none: { maximumFractionDigits: 2 },
};

/** Sliders cover the useful part of a range; the number field still accepts the whole spec range. */
const SLIDER_RANGES: Partial<Record<PropertyKey, [number, number]>> = {
  rotateX: [-60, 60],
  rotateY: [-60, 60],
  rotateZ: [-45, 45],
  cameraX: [-60, 60],
  cameraY: [-60, 60],
  cameraZ: [-45, 45],
  zoom: [0.5, 4],
  scale: [0.25, 2],
};

export const SECONDS_FORMAT: Intl.NumberFormatOptions = {
  style: "unit",
  unit: "second",
  unitDisplay: "narrow",
  maximumFractionDigits: 2,
};

export function propertyFormat(spec: PropertySpec): Intl.NumberFormatOptions {
  return FORMATS[spec.unit];
}

export function propertySliderRange(key: PropertyKey, spec: PropertySpec): [number, number] {
  return SLIDER_RANGES[key] ?? [spec.min, spec.max];
}
