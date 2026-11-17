import { describe, expect, it } from "vitest";
import type { PropertyValues } from "../storyboard/property-evaluation";
import { PROPERTY_KEYS, PROPERTY_SPECS } from "../storyboard/property-specs";
import { cameraRig, deviceWorldSize, fitDistance, layerPlacement } from "./camera-rig";

const defaults = Object.fromEntries(
  PROPERTY_KEYS.map((key) => [key, PROPERTY_SPECS[key].defaultValue])
) as PropertyValues;
const values = (overrides: Partial<PropertyValues>): PropertyValues => ({ ...defaults, ...overrides });

const device = deviceWorldSize({ width: 1920, height: 1080 });
const frame = { width: 1080, height: 1920 };

/** Projects a world point through the rig; returns frame fractions from the centre (x right, y up). */
function project(rig: ReturnType<typeof cameraRig>, point: [number, number, number]) {
  const sub = (a: number[], b: number[]) => a.map((value, index) => value - (b[index] ?? 0));
  const dot = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
  const cross = (a: number[], b: number[]) => [
    (a[1] ?? 0) * (b[2] ?? 0) - (a[2] ?? 0) * (b[1] ?? 0),
    (a[2] ?? 0) * (b[0] ?? 0) - (a[0] ?? 0) * (b[2] ?? 0),
    (a[0] ?? 0) * (b[1] ?? 0) - (a[1] ?? 0) * (b[0] ?? 0),
  ];
  const forward = sub(rig.target, rig.position).map((value) => value / rig.distance);
  const right = cross(forward, rig.up);
  const up = cross(right, forward);
  const relative = sub(point, rig.position);
  const depth = dot(relative, forward);
  const halfHeight = depth * Math.tan((rig.fov * Math.PI) / 360);
  const halfWidth = (halfHeight * frame.width) / frame.height;
  return { x: dot(relative, right) / halfWidth / 2, y: dot(relative, up) / halfHeight / 2, depth };
}

describe("cameraRig", () => {
  it("fits the device to the frame at zoom 1 (contain)", () => {
    const rig = cameraRig(defaults, device, frame);
    const corner = project(rig, [device.width / 2, device.height / 2, 0]);
    expect(Math.max(Math.abs(corner.x), Math.abs(corner.y))).toBeCloseTo(0.5);
    expect(corner.x).toBeCloseTo(0.5);
  });

  it("keeps the same framing at zoom 1 whatever the field of view", () => {
    for (const fov of [15, 35, 90]) {
      const rig = cameraRig(values({ fov }), device, frame);
      expect(project(rig, [device.width / 2, 0, 0]).x).toBeCloseTo(0.5);
      expect(rig.distance).toBeCloseTo(fitDistance(device, frame, fov));
    }
  });

  it("dollies in with zoom", () => {
    const rig = cameraRig(values({ zoom: 2 }), device, frame);
    expect(rig.distance).toBeCloseTo(fitDistance(device, frame, 35) / 2);
    expect(project(rig, [device.width / 4, 0, 0]).x).toBeCloseTo(0.5);
  });

  it("pans in fractions of the zoom-1 frame, y down, so zoom pushes in on the panned point", () => {
    const rig = cameraRig(values({ panX: 0.25, panY: 0.25, zoom: 3 }), device, frame);
    const fit = cameraRig(defaults, device, frame);
    const fitTarget = project(fit, rig.target);
    expect(fitTarget.x).toBeCloseTo(0.25);
    expect(fitTarget.y).toBeCloseTo(-0.25);
    const centre = project(rig, rig.target);
    expect(centre.x).toBeCloseTo(0);
  });

  it("moves the camera to the right for a positive camera Y, keeping its distance", () => {
    const rig = cameraRig(values({ cameraY: 30 }), device, frame);
    expect(rig.position[0]).toBeGreaterThan(0);
    expect(Math.hypot(...rig.position)).toBeCloseTo(rig.distance);
    const left = project(rig, [-device.width / 2, 0, 0]);
    const right = project(rig, [device.width / 2, 0, 0]);
    expect(right.depth).toBeLessThan(left.depth);
  });

  it("looks down from above for a positive camera X", () => {
    const rig = cameraRig(values({ cameraX: 20 }), device, frame);
    expect(rig.position[1]).toBeGreaterThan(0);
    expect(project(rig, [0, 0.5, 0]).depth).toBeLessThan(project(rig, [0, -0.5, 0]).depth);
    expect(project(rig, [0, 0, 0]).x).toBeCloseTo(0);
  });

  it("rolls the camera counter-clockwise for a positive camera Z, so the scene turns clockwise", () => {
    const rig = cameraRig(values({ cameraZ: 90 }), device, frame);
    expect(rig.up[0]).toBeCloseTo(-1);
    expect(project(rig, [0.5, 0, 0]).y).toBeLessThan(0);
  });

  it("frames the same at any orbit: zoom only sets the distance", () => {
    const base = cameraRig(defaults, device, frame);
    for (const orbit of [{ cameraX: 25 }, { cameraY: -60 }, { cameraX: -10, cameraY: 40, cameraZ: 15 }]) {
      expect(cameraRig(values(orbit), device, frame).distance).toBeCloseTo(base.distance);
    }
  });

  it("pans along the frame's axes whatever the orbit and roll", () => {
    const orbit = { cameraX: 15, cameraY: 40, cameraZ: 30 };
    const centred = cameraRig(values(orbit), device, frame);
    const panned = cameraRig(values({ ...orbit, panX: 0.25, panY: 0.1 }), device, frame);
    const origin = project(panned, [0, 0, 0]);
    const reference = project(centred, panned.target);
    expect(reference.x).toBeCloseTo(0.25);
    expect(reference.y).toBeCloseTo(-0.1);
    expect(origin.x).toBeCloseTo(-0.25);
  });

  it("leaves the camera alone when the device rotates", () => {
    expect(cameraRig(values({ rotateX: 20, rotateY: 30, rotateZ: 5 }), device, frame)).toEqual(
      cameraRig(defaults, device, frame)
    );
  });

  it("keeps the near plane in front of the device", () => {
    const rig = cameraRig(values({ zoom: 10 }), device, frame);
    expect(rig.near).toBeLessThan(rig.distance);
    expect(rig.far).toBeGreaterThan(rig.distance);
  });
});

describe("layerPlacement", () => {
  it("maps frame fractions to NDC offsets with y down", () => {
    expect(layerPlacement({ scale: 1.5, x: 0.25, y: 0.1 })).toEqual({
      scale: 1.5,
      offsetX: 0.5,
      offsetY: -0.2,
    });
  });
});
