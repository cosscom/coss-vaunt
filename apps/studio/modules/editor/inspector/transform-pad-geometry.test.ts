import { describe, expect, it } from "vitest";
import {
  clipRect,
  dragPosition,
  dragScale,
  padFrame,
  padZone,
  transformNudge,
} from "./transform-pad-geometry";

const frame = padFrame(16 / 9);
const rest = { x: 0, y: 0, scale: 1 };

describe("transform pad geometry", () => {
  it("fits the frame to the output's shape, and a portrait frame by its height", () => {
    expect(frame).toMatchObject({ width: 148, height: expect.closeTo(83.25) });
    expect(padFrame(9 / 16)).toMatchObject({ width: expect.closeTo(83.25), height: 148 });
  });

  it("draws the clip filling the frame at rest, and moved and scaled as the stage places it", () => {
    expect(clipRect(frame, rest)).toMatchObject({ left: frame.left, width: frame.width });
    const moved = clipRect(frame, { x: 0.25, y: -0.1, scale: 0.5 });
    expect(moved.centre.x).toBeCloseTo(frame.left + frame.width * 0.75);
    expect(moved.centre.y).toBeCloseTo(frame.top + frame.height * 0.4);
    expect(moved.width).toBeCloseTo(74);
  });

  it("scales from a corner and moves from anywhere else", () => {
    const [topLeft] = clipRect(frame, rest).corners;
    expect(padZone(frame, rest, { x: topLeft.x + 3, y: topLeft.y + 2 })).toBe("scale");
    expect(padZone(frame, rest, clipRect(frame, rest).centre)).toBe("move");
  });

  it("moves by fractions of the frame, along one axis with Shift", () => {
    expect(dragPosition(frame, rest, { x: 37, y: 8.325 }, false)).toEqual({ x: 0.25, y: 0.1 });
    expect(dragPosition(frame, rest, { x: 37, y: 8.325 }, true)).toEqual({ x: 0.25, y: 0 });
  });

  it("scales so the dragged corner follows the pointer, without jumping where it was grabbed", () => {
    const { centre, corners } = clipRect(frame, rest);
    const grab = { x: corners[2].x - 4, y: corners[2].y - 3 };
    expect(dragScale(frame, rest, grab, grab)).toBe(1);
    const halfway = { x: centre.x + (grab.x - centre.x) / 2, y: centre.y + (grab.y - centre.y) / 2 };
    expect(dragScale(frame, rest, grab, halfway)).toBe(0.5);
  });

  it("nudges with arrows and scales with brackets", () => {
    expect(transformNudge("ArrowRight", false, rest)).toEqual({ key: "x", value: 0.01 });
    expect(transformNudge("ArrowUp", true, rest)).toEqual({ key: "y", value: -0.1 });
    expect(transformNudge("BracketRight", false, rest)).toEqual({ key: "scale", value: 1.01 });
    expect(transformNudge("KeyA", false, rest)).toBeNull();
  });
});
