import { describe, expect, it } from "vitest";
import { evaluateClipProperties, type PropertyValues } from "../storyboard/property-evaluation";
import type { BlurSettings } from "../storyboard/storyboard-schema";
import { blurGuideShapes } from "./blur-guides";
import { layerGeometry } from "./camera-projection";
import { deviceWorldSize } from "./camera-rig";
import { depthOfFieldParams } from "./depth-of-field";

function guides(settings: Partial<BlurSettings>, change: Partial<PropertyValues>) {
  const values = { ...evaluateClipProperties({ properties: {} }, 0), ...change };
  const geometry = layerGeometry(values, values, deviceWorldSize({ width: 1920, height: 1080 }), {
    width: 1600,
    height: 900,
  });
  const full: BlurSettings = { enabled: true, mode: "lens", focus: "auto", ...settings };
  return blurGuideShapes(full, depthOfFieldParams(full, values, geometry), geometry, [
    values.focusX,
    values.focusY,
  ]);
}

describe("blurGuideShapes", () => {
  it("draws the lens focus line through the focus point of a turned device", () => {
    const shapes = guides({}, { rotateY: 40, focusX: 0.5 });
    const [[x0, y0], [x1, y1]] = shapes.focusLine ?? [
      [0, 0],
      [0, 0],
    ];
    const [px, py] = shapes.focusPoint ?? [0, 0];
    const cross = (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0);
    expect(Math.abs(cross) / Math.hypot(x1 - x0, y1 - y0)).toBeLessThan(1);
    expect(shapes.cells).toHaveLength(256);
    expect(Math.max(...shapes.cells.map((cell) => cell.amount))).toBeGreaterThan(0);
  });

  it("has no focus point for manual focus", () => {
    expect(guides({ focus: "manual" }, {}).focusPoint).toBeNull();
  });

  it("shows a band for tilt shift and a streak for directional", () => {
    const tilt = guides({ mode: "tilt-shift" }, { focusRange: 0.2 });
    expect(tilt.falloff?.shape).toBe("band");
    expect(tilt.falloff?.edges.map((edge) => edge.map(([, y]) => Math.round(y)))).toEqual([
      [360, 360],
      [540, 540],
    ]);
    expect(tilt.cells).toHaveLength(256);
    expect(guides({ mode: "directional" }, { blurAngle: 90 }).streak?.[1][1]).toBeLessThan(450);
  });

  it("lays the sharp area on the device, so it foreshortens as the device turns", () => {
    const ring = guides({ mode: "radial" }, { focusRange: 0.4, rotateY: 60 }).falloff?.edges[0] ?? [];
    const xs = ring.map(([x]) => x);
    const ys = ring.map(([, y]) => y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan((Math.max(...ys) - Math.min(...ys)) * 0.7);
  });
});
