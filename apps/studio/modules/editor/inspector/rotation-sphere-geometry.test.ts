import { deviceRotation, transform as stageTransform } from "@calcom/product-video/stage/device-pose";
import { describe, expect, it } from "vitest";
import {
  circlePaths,
  dragRotation,
  dragZone,
  EQUATOR,
  FACE,
  keyboardNudge,
  POLE,
  projectPoint,
  quantizeDegrees,
  ringAngle,
  ringRotation,
  rotationMatrix,
  transform,
  type Vec3,
  wrapDegrees,
} from "./rotation-sphere-geometry";

const FRAME = { cx: 100, cy: 100, r: 50 };
const IDENTITY = rotationMatrix({ rotateX: 0, rotateY: 0, rotateZ: 0 });

function expectVec(actual: Vec3, expected: Vec3): void {
  for (const [i, value] of actual.entries()) expect(value).toBeCloseTo(expected[i] ?? Number.NaN, 6);
}

describe("rotationMatrix", () => {
  it("turns the face right for Y, down for X and spins counter-clockwise for Z", () => {
    expectVec(transform(rotationMatrix({ rotateX: 0, rotateY: 90, rotateZ: 0 }), FACE), [1, 0, 0]);
    expectVec(transform(rotationMatrix({ rotateX: 90, rotateY: 0, rotateZ: 0 }), FACE), [0, -1, 0]);
    expectVec(transform(rotationMatrix({ rotateX: 0, rotateY: 0, rotateZ: 90 }), POLE), [-1, 0, 0]);
  });

  it("matches the rotation the stage applies to the device", () => {
    for (const rotation of [
      { rotateX: 30, rotateY: -20, rotateZ: 0 },
      { rotateX: 60, rotateY: 45, rotateZ: 15 },
      { rotateX: -120, rotateY: 170, rotateZ: -75 },
    ]) {
      for (const v of [FACE, POLE]) {
        expectVec(transform(rotationMatrix(rotation), v), stageTransform(deviceRotation(rotation), [...v]));
      }
    }
  });
});

describe("projectPoint", () => {
  it("puts the pole at the top and the face at the centre, facing the viewer", () => {
    expect(projectPoint(IDENTITY, POLE, FRAME)).toMatchObject({ x: 100, y: 50 });
    expect(projectPoint(IDENTITY, FACE, FRAME)).toEqual({ x: 100, y: 100, depth: 1 });
  });
});

describe("circlePaths", () => {
  it("splits a circle into a front and a back half at the silhouette", () => {
    const { front, back } = circlePaths(
      EQUATOR,
      rotationMatrix({ rotateX: 30, rotateY: 0, rotateZ: 0 }),
      FRAME
    );
    const ys = (path: string) =>
      [...path.matchAll(/[ML][\d.-]+ ([\d.-]+)/g)].map((match) => Number(match[1]));
    expect(ys(front).length).toBeGreaterThan(10);
    expect(ys(back).length).toBeGreaterThan(10);
    expect(Math.min(...ys(front))).toBeGreaterThanOrEqual(100);
    expect(Math.max(...ys(back))).toBeLessThanOrEqual(100);
  });

  it("leaves the back empty when the whole circle faces the viewer", () => {
    const { front, back } = circlePaths(
      { centre: [0, 0, 0.8], u: [0.6, 0, 0], v: [0, 0.6, 0] },
      IDENTITY,
      FRAME
    );
    expect(front).not.toBe("");
    expect(back).toBe("");
  });
});

describe("wrapDegrees and quantizeDegrees", () => {
  it("wraps into −180..180 and keeps 180", () => {
    expect(wrapDegrees(180)).toBe(180);
    expect(wrapDegrees(190)).toBe(-170);
    expect(wrapDegrees(-190)).toBe(170);
    expect(wrapDegrees(725)).toBe(5);
  });

  it("rounds to the 0.5° step, or to 15° while snapping", () => {
    expect(quantizeDegrees(12.26, false)).toBe(12.5);
    expect(quantizeDegrees(-0.2, false)).toBe(0);
    expect(Object.is(quantizeDegrees(-0.2, false), -0)).toBe(false);
    expect(quantizeDegrees(22, true)).toBe(15);
    expect(quantizeDegrees(23, true)).toBe(30);
  });
});

describe("dragRotation", () => {
  it("turns Y with horizontal drags and X with vertical drags, a radian per radius", () => {
    expect(dragRotation({ rotateX: 0, rotateY: 0 }, { x: 50, y: 0 }, 50, false)).toEqual({
      rotateX: 0,
      rotateY: 57.5,
    });
    expect(dragRotation({ rotateX: 10, rotateY: 5 }, { x: -20, y: 25 }, 50, true)).toEqual({
      rotateX: 45,
      rotateY: -15,
    });
  });

  it("wraps past ±180", () => {
    expect(dragRotation({ rotateX: 0, rotateY: 170 }, { x: 50, y: 0 }, 50, false).rotateY).toBe(-132.5);
  });
});

describe("ring", () => {
  it("measures angles counter-clockwise from the right", () => {
    expect(ringAngle({ x: 150, y: 100 }, FRAME)).toBe(0);
    expect(ringAngle({ x: 100, y: 50 }, FRAME)).toBe(90);
    expect(ringAngle({ x: 100, y: 150 }, FRAME)).toBe(-90);
  });

  it("rolls by the angle swept, across the ±180 seam", () => {
    expect(ringRotation(0, 0, 90, false)).toBe(90);
    expect(ringRotation(10, 170, -170, false)).toBe(30);
    expect(ringRotation(0, 0, -50, true)).toBe(-45);
  });

  it("tells the sphere from the ring around it", () => {
    expect(dragZone({ x: 100, y: 60 }, FRAME, 12)).toBe("sphere");
    expect(dragZone({ x: 100, y: 45 }, FRAME, 12)).toBe("ring");
    expect(dragZone({ x: 100, y: 30 }, FRAME, 12)).toBeNull();
  });
});

describe("keyboardNudge", () => {
  const rotation = { rotateX: 0, rotateY: 179.5, rotateZ: 0 };

  it("nudges by 1°, or 10° with Shift, wrapping past 180", () => {
    expect(keyboardNudge("ArrowRight", false, rotation)).toEqual({ key: "rotateY", value: -179.5 });
    expect(keyboardNudge("ArrowUp", true, rotation)).toEqual({ key: "rotateX", value: -10 });
    expect(keyboardNudge("BracketRight", true, rotation)).toEqual({ key: "rotateZ", value: 10 });
    expect(keyboardNudge("KeyA", false, rotation)).toBeNull();
  });
});
