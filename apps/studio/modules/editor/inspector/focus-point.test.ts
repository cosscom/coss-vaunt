import { describe, expect, it } from "vitest";
import { driftPath, focusFromPointer, focusPercent, nudgeFocus } from "./focus-point";

const box = { left: 100, top: 50, width: 200, height: 100 };

describe("focusFromPointer", () => {
  it("maps the media's corners and centre to -1, 0 and 1", () => {
    expect(focusFromPointer(box, 100, 50)).toEqual({ x: -1, y: -1 });
    expect(focusFromPointer(box, 200, 100)).toEqual({ x: 0, y: 0 });
    expect(focusFromPointer(box, 300, 150)).toEqual({ x: 1, y: 1 });
  });

  it("clamps a pointer dragged outside the media", () => {
    expect(focusFromPointer(box, 0, 400)).toEqual({ x: -1, y: 1 });
  });
});

describe("nudgeFocus", () => {
  it("steps with the arrow keys, further with Shift, and stops at the edge", () => {
    expect(nudgeFocus({ x: 0, y: 0 }, "ArrowRight", false)).toEqual({ x: 0.05, y: 0 });
    expect(nudgeFocus({ x: 0, y: 0 }, "ArrowUp", true)).toEqual({ x: 0, y: -0.2 });
    expect(nudgeFocus({ x: 0.98, y: 0 }, "ArrowRight", true)).toEqual({ x: 1, y: 0 });
    expect(nudgeFocus({ x: 0, y: 0 }, "Enter", false)).toBeNull();
  });
});

describe("focusPercent", () => {
  it("places the marker within the picker", () => {
    expect(focusPercent({ x: -1, y: 0.5 })).toEqual({ left: "0%", top: "75%" });
  });
});

describe("driftPath", () => {
  const drift = {
    focus: { x: 0, y: 0 },
    zoom: 1.5,
    motion: "slide" as const,
    direction: "left" as const,
    intensity: 1,
  };

  it("runs the frame rightwards across the media when the media drifts left, through the focus", () => {
    expect(driftPath(drift)).toEqual({ from: { x: 40, y: 50 }, to: { x: 60, y: 50 } });
  });

  it("is shorter at lower intensity and absent when it doesn't slide", () => {
    expect(driftPath({ ...drift, intensity: 0.5, direction: "up" })).toEqual({
      from: { x: 50, y: 45 },
      to: { x: 50, y: 55 },
    });
    expect(driftPath({ ...drift, motion: "tilt" })).toBeNull();
  });
});
