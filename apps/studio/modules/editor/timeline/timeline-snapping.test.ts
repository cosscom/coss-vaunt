import { describe, expect, it } from "vitest";
import { roundToGrid, snapSpanStart, snapTime } from "./timeline-snapping";

const options = { targets: [0, 2, 5], thresholdSeconds: 0.15, free: false };

describe("snapTime", () => {
  it("snaps to a nearby target", () => {
    expect(snapTime(2.1, options)).toBe(2);
  });

  it("falls back to the 0.1 s grid", () => {
    expect(snapTime(3.27, options)).toBe(3.3);
    expect(roundToGrid(0.30000000000000004)).toBe(0.3);
  });

  it("moves freely with Shift", () => {
    expect(snapTime(2.1, { ...options, free: true })).toBe(2.1);
  });
});

describe("snapSpanStart", () => {
  it("snaps the end edge onto a target", () => {
    expect(snapSpanStart(1.92, 3, options)).toBe(2);
    expect(snapSpanStart(2.08, 3, options)).toBe(2);
    expect(snapSpanStart(1.1, 3.95, options)).toBeCloseTo(1.05);
  });

  it("never goes before zero", () => {
    expect(snapSpanStart(-1, 3, { ...options, free: true })).toBe(0);
  });
});
