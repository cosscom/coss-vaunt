import { describe, expect, it } from "vitest";
import { evaluateClipProperties, type PropertyValues } from "../storyboard/property-evaluation";
import { devicePoint, frameToDevice, layerGeometry, projectToFrame } from "./camera-projection";
import { deviceWorldSize } from "./camera-rig";

const geometryFor = (change: Partial<PropertyValues> = {}) => {
  const values = { ...evaluateClipProperties({ properties: {} }, 0), ...change };
  return layerGeometry(values, values, deviceWorldSize({ width: 1920, height: 1080 }), {
    width: 1600,
    height: 900,
  });
};

describe("projectToFrame", () => {
  it("fills the frame with an unturned device at zoom 1", () => {
    const geometry = geometryFor();
    const centre = projectToFrame(geometry, devicePoint(geometry, 0, 0));
    const corner = projectToFrame(geometry, devicePoint(geometry, 1, 1));
    expect([centre.x, centre.y]).toEqual([expect.closeTo(800), expect.closeTo(450)]);
    expect([corner.x, corner.y]).toEqual([expect.closeTo(1600), expect.closeTo(900)]);
  });

  it("follows the clip's placement in the frame", () => {
    const geometry = geometryFor({ scale: 0.5, x: 0.25 });
    const centre = projectToFrame(geometry, devicePoint(geometry, 0, 0));
    expect(centre.x).toBeCloseTo(1200);
  });
});

describe("frameToDevice", () => {
  it("inverts the projection on a turned, panned device", () => {
    const geometry = geometryFor({ rotateX: 20, rotateY: -35, cameraY: 15, panX: 0.1, scale: 0.8 });
    const projected = projectToFrame(geometry, devicePoint(geometry, 0.4, -0.6));
    const local = frameToDevice(geometry, projected.x, projected.y);
    expect(local?.[0]).toBeCloseTo(0.4);
    expect(local?.[1]).toBeCloseTo(-0.6);
  });
});
