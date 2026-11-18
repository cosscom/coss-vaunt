import { describe, expect, it } from "vitest";
import { evaluateClipProperties, type PropertyValues } from "../storyboard/property-evaluation";
import type { BlurSettings } from "../storyboard/storyboard-schema";
import { devicePoint, layerGeometry, projectToFrame } from "./camera-projection";
import { deviceWorldSize } from "./camera-rig";
import { circleOfConfusion, depthOfFieldParams } from "./depth-of-field";

const lens: BlurSettings = { enabled: true, mode: "lens", focus: "auto" };

function blurAt(settings: BlurSettings, change: Partial<PropertyValues>, x: number, y: number): number {
  const values = { ...evaluateClipProperties({ properties: {} }, 0), blur: 1, ...change };
  const geometry = layerGeometry(values, values, deviceWorldSize({ width: 1920, height: 1080 }), {
    width: 1600,
    height: 900,
  });
  const params = depthOfFieldParams(settings, values, geometry);
  const point = projectToFrame(geometry, devicePoint(geometry, x, y));
  return circleOfConfusion(
    params,
    point.x / geometry.frame.width,
    point.y / geometry.frame.height,
    point.depth
  );
}

describe("lens depth of field", () => {
  it("keeps the focus point sharp as the device turns (tracking)", () => {
    for (const rotateY of [-50, 0, 35, 60]) {
      expect(blurAt(lens, { rotateY, focusX: 0.8, focusY: 0.2 }, 0.8, 0.2)).toBe(0);
    }
  });

  it("blurs the side of a turned device away from the focus point", () => {
    expect(blurAt(lens, { rotateY: 50, focusX: 0.9, focusRange: 0 }, -0.9, 0)).toBeGreaterThan(0.3);
  });

  it("holds a manual focus distance while the device turns", () => {
    const manual: BlurSettings = { ...lens, focus: "manual" };
    expect(blurAt(manual, { rotateY: 0 }, 0, 0)).toBe(0);
    expect(blurAt(manual, { rotateY: 60, focusRange: 0 }, 0.9, 0)).toBeGreaterThan(0);
    expect(blurAt(manual, { focusDistance: 2, focusRange: 0 }, 0, 0)).toBeGreaterThan(0);
  });

  it("scales with strength", () => {
    const change = { rotateY: 50, focusX: 0.9, focusRange: 0 };
    expect(blurAt(lens, { ...change, blur: 0.5 }, -0.9, 0)).toBeCloseTo(blurAt(lens, change, -0.9, 0) / 2);
  });
});

describe("screen-space depth of field", () => {
  it("radial stays sharp around the focus point and blurs towards the edges", () => {
    const radial: BlurSettings = { ...lens, mode: "radial" };
    expect(blurAt(radial, { focusRange: 0.3 }, 0.1, 0.1)).toBe(0);
    expect(blurAt(radial, { focusRange: 0.3 }, 1, 1)).toBe(1);
  });

  it("tilt shift keeps a band along the angle sharp", () => {
    const tiltShift: BlurSettings = { ...lens, mode: "tilt-shift" };
    expect(blurAt(tiltShift, { focusRange: 0.2 }, 1, 0)).toBe(0);
    expect(blurAt(tiltShift, { focusRange: 0.2 }, 0, 1)).toBeGreaterThan(0.5);
    expect(blurAt(tiltShift, { focusRange: 0.2, blurAngle: 90 }, 0, 1)).toBe(0);
  });
});

describe("depth of field measured on the device", () => {
  const radial: BlurSettings = { ...lens, mode: "radial" };

  it("keeps the same patch of the recording sharp however the device turns", () => {
    for (const change of [{}, { rotateY: 60 }, { rotateX: -45, rotateZ: 30 }, { cameraY: 40, zoom: 2 }]) {
      const focus = { ...change, focusX: -0.4, focusY: 0.3, focusRange: 0.2 };
      expect(blurAt(radial, focus, -0.35, 0.3)).toBe(0);
      expect(blurAt(radial, focus, 0.6, -0.6)).toBe(1);
    }
  });

  it("keeps a tilt-shift band along the device's own width as it rolls", () => {
    const tiltShift: BlurSettings = { ...lens, mode: "tilt-shift" };
    const rolled = { rotateZ: 40, focusRange: 0.1 };
    expect(blurAt(tiltShift, rolled, 0.9, 0)).toBe(0);
    expect(blurAt(tiltShift, rolled, 0, 0.9)).toBe(1);
  });
});
