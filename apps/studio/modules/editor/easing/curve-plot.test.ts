import type { CubicPoints } from "@calcom/product-video/storyboard/storyboard-schema";
import { describe, expect, it } from "vitest";
import { curvePath, fromPointer, handleOnPlot, moveHandle, nudgeHandle, toPlot } from "./curve-plot";

const points: CubicPoints = [0.42, 0, 0.58, 1];
const rect = { left: 10, top: 20, width: 120, height: 150 };

describe("plot mapping", () => {
  it("puts (0, 0) and (1, 1) inside the padded view box", () => {
    expect(toPlot(0, 0)).toEqual({ x: 0, y: 125 });
    expect(toPlot(1, 1)).toEqual({ x: 100, y: 25 });
  });

  it("maps a pointer back to curve space, including above the unit box", () => {
    const origin = fromPointer(20, 145, rect);
    expect(origin.x).toBeCloseTo(0);
    expect(origin.y).toBeCloseTo(0);
    const top = fromPointer(70, 20, rect);
    expect(top.x).toBeCloseTo(0.5);
    expect(top.y).toBeCloseTo(1.25);
  });

  it("draws the curve from (0, 0) to (1, 1) through both handles", () => {
    expect(curvePath(points)).toBe("M 0 125 C 42 125 58 25 100 25");
  });

  it("pins a handle beyond the visible range to the edge", () => {
    expect(handleOnPlot(0.5, 1.6)).toEqual({ x: 50, y: 0, offScale: true });
    expect(handleOnPlot(0.5, 1)).toEqual({ x: 50, y: 25, offScale: false });
  });
});

describe("moveHandle", () => {
  it("moves only the dragged handle and clamps x to [0, 1] and y to [-1, 2]", () => {
    expect(moveHandle(points, 1, { x: 1.4, y: 2.6 }, false)).toEqual([0.42, 0, 1, 2]);
    expect(moveHandle(points, 0, { x: -0.2, y: -1.5 }, false)).toEqual([0, -1, 0.58, 1]);
  });

  it("rounds to 0.01 so the CSS stays short", () => {
    expect(moveHandle(points, 0, { x: 0.6963, y: 0.8412 }, false)).toEqual([0.7, 0.84, 0.58, 1]);
  });

  it("snaps to 0.05 with Shift", () => {
    expect(moveHandle(points, 0, { x: 0.33, y: 1.18 }, true)).toEqual([0.35, 1.2, 0.58, 1]);
  });
});

describe("nudgeHandle", () => {
  it("nudges by 0.01, or 0.1 coarsely", () => {
    expect(nudgeHandle(points, 0, "ArrowRight", false)).toEqual([0.43, 0, 0.58, 1]);
    expect(nudgeHandle(points, 1, "ArrowDown", true)).toEqual([0.42, 0, 0.58, 0.9]);
  });

  it("ignores other keys", () => {
    expect(nudgeHandle(points, 0, "Enter", false)).toBeNull();
  });
});
