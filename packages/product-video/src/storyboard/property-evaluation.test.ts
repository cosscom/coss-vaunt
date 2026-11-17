import { describe, expect, it } from "vitest";
import { evaluateClipProperties, evaluateProperty } from "./property-evaluation";

const keyframe = (at: number, value: number, ease: "linear" | "hold" = "linear") => ({
  id: `k${at}`,
  at,
  value,
  ease,
});

describe("evaluateProperty", () => {
  it("uses the static value without keyframes", () => {
    expect(evaluateProperty({ value: 1.2, keyframes: [] }, 3)).toBe(1.2);
  });

  it("holds a single keyframe everywhere", () => {
    expect(evaluateProperty({ value: 0, keyframes: [keyframe(2, 5)] }, 0)).toBe(5);
    expect(evaluateProperty({ value: 0, keyframes: [keyframe(2, 5)] }, 9)).toBe(5);
  });

  it("interpolates between keyframes using the later keyframe's ease", () => {
    const zoom = { value: 1, keyframes: [keyframe(3, 1.6), keyframe(0, 1)] };
    expect(evaluateProperty(zoom, 1.5)).toBeCloseTo(1.3);
    expect(evaluateProperty(zoom, 4)).toBeCloseTo(1.6);
  });

  it("jumps at a hold keyframe", () => {
    const hold = { value: 0, keyframes: [keyframe(0, 0), keyframe(2, 10, "hold")] };
    expect(evaluateProperty(hold, 1.99)).toBe(0);
    expect(evaluateProperty(hold, 2)).toBe(10);
  });
});

describe("evaluateClipProperties", () => {
  it("fills unset properties with their defaults", () => {
    const values = evaluateClipProperties({ properties: { rotateY: { value: 20, keyframes: [] } } }, 0);
    expect(values.rotateY).toBe(20);
    expect(values.zoom).toBe(1);
    expect(values.opacity).toBe(1);
  });
});
