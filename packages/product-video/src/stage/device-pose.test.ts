import { describe, expect, it } from "vitest";
import { deviceWorldSize, type Vec3 } from "./camera-rig";
import {
  deviceRotation,
  floorHeight,
  REFLECTION_FADE_HEIGHT,
  reflectionAlpha,
  shadowFootprint,
  transform,
} from "./device-pose";

const device = deviceWorldSize({ width: 1920, height: 1080 });
const rotation = (rotateX: number, rotateY: number, rotateZ: number) =>
  deviceRotation({ rotateX, rotateY, rotateZ });

function expectVec(actual: Vec3, expected: Vec3): void {
  for (const [i, value] of actual.entries()) expect(value).toBeCloseTo(expected[i] ?? Number.NaN, 6);
}

describe("deviceRotation", () => {
  it("turns the face right for Y, down for X and spins counter-clockwise for Z", () => {
    expectVec(transform(rotation(0, 90, 0), [0, 0, 1]), [1, 0, 0]);
    expectVec(transform(rotation(90, 0, 0), [0, 0, 1]), [0, -1, 0]);
    expectVec(transform(rotation(0, 0, 90), [0, 1, 0]), [-1, 0, 0]);
  });

  it("applies Z, then X, then Y", () => {
    expectVec(transform(rotation(90, 90, 0), [0, 0, 1]), [0, -1, 0]);
    expectVec(transform(rotation(0, 90, 90), [1, 0, 0]), [0, 1, 0]);
  });
});

describe("floorHeight", () => {
  const rest = floorHeight(device, rotation(0, 0, 0));
  const gap = -0.5 - rest;

  it("sits just under the resting device, whatever its turn", () => {
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(0.02);
    expect(floorHeight(device, rotation(0, 40, 0))).toBeCloseTo(rest);
  });

  it("keeps the same gap under the lowest point of a tilted or rolled device", () => {
    const tilted = -0.5 * Math.cos(Math.PI / 6);
    expect(floorHeight(device, rotation(-30, 0, 0))).toBeCloseTo(tilted - gap);
    const corner = -(0.5 * Math.cos(Math.PI / 18) + (device.width / 2) * Math.sin(Math.PI / 18));
    expect(floorHeight(device, rotation(0, 0, 10))).toBeCloseTo(corner - gap);
  });
});

describe("shadowFootprint", () => {
  const footprint = (x: number, y: number, z: number) => {
    const turned = rotation(x, y, z);
    return shadowFootprint(device, turned, floorHeight(device, turned));
  };

  it("is a line under the resting device, all of it touching the floor", () => {
    const { axis, outline, contact } = footprint(0, 0, 0);
    expectVec([...axis, 0], [1, 0, 0]);
    expect(outline).toEqual({ centre: [0, 0], width: device.width, depth: 0 });
    expect(contact).toEqual(outline);
  });

  it("turns with the device on the floor", () => {
    const { axis, outline } = footprint(0, 30, 0);
    expectVec([...axis, 0], [Math.cos(Math.PI / 6), -Math.sin(Math.PI / 6), 0]);
    expect(outline.width).toBeCloseTo(device.width);
  });

  it("spreads with tilt while the contact stays along the bottom edge", () => {
    const { outline, contact } = footprint(40, 0, 0);
    expect(outline.depth).toBeCloseTo(Math.sin((40 * Math.PI) / 180));
    expect(contact.depth).toBeLessThan(outline.depth / 4);
    expect(contact.centre[1]).toBeLessThan(0);
  });

  it("follows the edge lying along the floor when the device is rolled upright", () => {
    const { outline } = footprint(0, 0, 90);
    expect(outline.width).toBeCloseTo(device.height);
    expect(outline.depth).toBeCloseTo(0);
  });

  it("only touches the floor under the lowest corner of a rolled device", () => {
    const { outline, contact } = footprint(0, 0, 12);
    expect(contact.width).toBeLessThan(outline.width / 2);
    expect(contact.centre[0]).toBeLessThan(0);
  });
});

describe("reflectionAlpha", () => {
  it("is strongest at the floor and fades out with height", () => {
    const at = (height: number) => reflectionAlpha(height, 0.4);
    expect(at(0)).toBeGreaterThan(at(0.1));
    expect(at(0.1)).toBeGreaterThan(at(0.3));
    expect(at(REFLECTION_FADE_HEIGHT)).toBe(0);
    expect(at(1)).toBe(0);
  });

  it("scales with the setting and never shows below the floor", () => {
    expect(reflectionAlpha(0.1, 0.8)).toBeCloseTo(2 * reflectionAlpha(0.1, 0.4));
    expect(reflectionAlpha(0.1, 0)).toBe(0);
    expect(reflectionAlpha(-0.01, 1)).toBe(0);
  });
});
