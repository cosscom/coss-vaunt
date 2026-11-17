export const PROPERTY_KEYS = [
  "rotateX",
  "rotateY",
  "rotateZ",
  "cameraX",
  "cameraY",
  "cameraZ",
  "zoom",
  "panX",
  "panY",
  "fov",
  "blur",
  "focusRange",
  "focusX",
  "focusY",
  "focusDistance",
  "blurAngle",
  "opacity",
  "scale",
  "x",
  "y",
] as const;

export type PropertyKey = (typeof PROPERTY_KEYS)[number];

export type PropertyGroup = "device" | "camera" | "blur" | "clip";

export type PropertySpec = {
  label: string;
  group: PropertyGroup;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: "deg" | "x" | "fraction" | "percent" | "none";
};

const degrees = { min: -180, max: 180, step: 0.5, defaultValue: 0, unit: "deg" } as const;

/**
 * Device properties turn the clip's device in the scene, above a floor that stays put; camera
 * properties move the viewpoint around the scene; clip properties place the finished clip in the
 * frame; blur properties shape depth of field. Pan, x and y are fractions of the output frame; the focus
 * point is a fraction of the device's half-size (y down), and focus distance a multiple of the camera's.
 */
export const PROPERTY_SPECS: Record<PropertyKey, PropertySpec> = {
  rotateX: { label: "Rotation X", group: "device", ...degrees },
  rotateY: { label: "Rotation Y", group: "device", ...degrees },
  rotateZ: { label: "Rotation Z", group: "device", ...degrees },
  cameraX: { label: "Camera X", group: "camera", ...degrees },
  cameraY: { label: "Camera Y", group: "camera", ...degrees },
  cameraZ: { label: "Camera Z", group: "camera", ...degrees },
  zoom: { label: "Zoom", group: "camera", min: 0.1, max: 10, step: 0.01, defaultValue: 1, unit: "x" },
  panX: { label: "Pan X", group: "camera", min: -1, max: 1, step: 0.01, defaultValue: 0, unit: "fraction" },
  panY: { label: "Pan Y", group: "camera", min: -1, max: 1, step: 0.01, defaultValue: 0, unit: "fraction" },
  fov: { label: "Field of view", group: "camera", min: 10, max: 120, step: 1, defaultValue: 35, unit: "deg" },
  blur: { label: "Strength", group: "blur", min: 0, max: 1, step: 0.01, defaultValue: 0.5, unit: "percent" },
  focusRange: {
    label: "Focus range",
    group: "blur",
    min: 0,
    max: 1,
    step: 0.01,
    defaultValue: 0.3,
    unit: "percent",
  },
  focusX: { label: "Focus X", group: "blur", min: -1, max: 1, step: 0.01, defaultValue: 0, unit: "fraction" },
  focusY: { label: "Focus Y", group: "blur", min: -1, max: 1, step: 0.01, defaultValue: 0, unit: "fraction" },
  focusDistance: {
    label: "Focus distance",
    group: "blur",
    min: 0.1,
    max: 4,
    step: 0.01,
    defaultValue: 1,
    unit: "x",
  },
  blurAngle: { label: "Angle", group: "blur", ...degrees },
  opacity: { label: "Opacity", group: "clip", min: 0, max: 1, step: 0.01, defaultValue: 1, unit: "percent" },
  scale: { label: "Scale", group: "clip", min: 0.1, max: 4, step: 0.01, defaultValue: 1, unit: "x" },
  x: { label: "Position X", group: "clip", min: -1, max: 1, step: 0.01, defaultValue: 0, unit: "fraction" },
  y: { label: "Position Y", group: "clip", min: -1, max: 1, step: 0.01, defaultValue: 0, unit: "fraction" },
};
