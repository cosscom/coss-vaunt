import { describe, expect, it } from "vitest";
import { evaluateClipProperties, type PropertyValues } from "../storyboard/property-evaluation";
import type { BlurSettings } from "../storyboard/storyboard-schema";
import { blurGuideShapes } from "./blur-guides";
import { angleAt, blurHandleAt, rangeAt } from "./blur-handles";
import { devicePoint, layerGeometry, projectToFrame } from "./camera-projection";
import { deviceWorldSize } from "./camera-rig";
import { depthOfFieldParams } from "./depth-of-field";

function setup(mode: BlurSettings["mode"], change: Partial<PropertyValues> = {}) {
  const values = { ...evaluateClipProperties({ properties: {} }, 0), focusRange: 0.4, ...change };
  const geometry = layerGeometry(values, values, deviceWorldSize({ width: 1920, height: 1080 }), {
    width: 1600,
    height: 900,
  });
  const settings: BlurSettings = { enabled: true, mode, focus: "auto" };
  const shapes = blurGuideShapes(settings, depthOfFieldParams(settings, values, geometry), geometry, [
    values.focusX,
    values.focusY,
  ]);
  return { values, geometry, shapes };
}

describe("blurHandleAt", () => {
  it("grabs the angle dot, the focus point and the dashed edge, and nothing elsewhere", () => {
    const { shapes } = setup("directional");
    const [hx, hy] = shapes.angleHandle ?? [0, 0];
    expect(blurHandleAt(shapes, [hx + 3, hy])).toBe("angle");
    // Range 0.4 is 0.2 device heights: 180 px above the centre of a device that fills the frame.
    expect(blurHandleAt(shapes, [800, 450 - 180 + 4])).toBe("range");
    expect(blurHandleAt(shapes, [800 + 6, 450])).toBe("focus");
    expect(blurHandleAt(shapes, [800 + 90, 450])).toBeNull();
  });
});

describe("dragging blur handles", () => {
  it("sets the range from the pointer's distance on the device, even when it's turned", () => {
    const { geometry, values } = setup("radial", { rotateY: 50 });
    const at = projectToFrame(geometry, devicePoint(geometry, 0, 0.5));
    expect(rangeAt(geometry, values, "radial", at.x, at.y)).toEqual({ focusRange: 0.5 });
  });

  it("points the angle from the focus towards the pointer on the device", () => {
    const { geometry, values } = setup("directional", { rotateZ: 90 });
    const up = projectToFrame(geometry, devicePoint(geometry, 0, -0.5));
    expect(angleAt(geometry, values, up.x, up.y)).toEqual({ blurAngle: 90 });
  });
});
