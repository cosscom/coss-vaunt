export const STAGE_COPY = {
  canvasMode: "Canvas mode",
  select: "Select",
  selectHint: "Click a layer to select it, drag to move it, ⇧-click to add to the selection",
  camera: "Camera",
  orbit: "Orbit",
  rotate: "Rotate",
  focus: "Focus",
  cameraHint: "Drag to pan, scroll to zoom, double-click to reset",
  orbitHint: "Drag to orbit the camera, ⌥-drag to roll it, scroll to zoom, double-click to reset",
  rotateHint: "Drag to rotate the device, ⌥-drag to spin it, scroll to zoom, double-click to reset",
  focusHint:
    "Click or drag on the device to set where blur focuses, drag the dashed edge for its range and the dot for its angle, double-click to reset",
  notRecorded: "Not recorded yet",
  refreshMedia: "Refresh media",
  refreshMediaHint: "Reload recordings and media",
  noWebgl: "WebGL isn’t available in this browser",
} as const;
