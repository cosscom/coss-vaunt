import { describe, expect, it } from "vitest";
import { loopedFrame } from "./looped-frame";

describe("loopedFrame", () => {
  it("advances at the recording's fps and wraps to the first frame", () => {
    expect(loopedFrame(0, 60, 240)).toBe(0);
    expect(loopedFrame(1000, 60, 240)).toBe(60);
    expect(loopedFrame(4000, 60, 240)).toBe(0);
    expect(loopedFrame(4050, 30, 120)).toBe(1);
  });

  it("holds the first frame before it starts and for an empty take", () => {
    expect(loopedFrame(-20, 60, 240)).toBe(0);
    expect(loopedFrame(500, 60, 0)).toBe(0);
  });
});
