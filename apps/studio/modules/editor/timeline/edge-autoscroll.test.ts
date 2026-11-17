import { describe, expect, it } from "vitest";
import { AUTOSCROLL_EDGE_PX, AUTOSCROLL_MAX_PX_PER_FRAME, autoscrollStep } from "./edge-autoscroll";

describe("autoscrollStep", () => {
  it("does not scroll away from the edges", () => {
    expect(autoscrollStep(500, 200, 1000)).toBe(0);
  });

  it("scrolls forwards near the end, faster the deeper the pointer", () => {
    const shallow = autoscrollStep(1000 - AUTOSCROLL_EDGE_PX + 8, 200, 1000);
    const deep = autoscrollStep(1000 - 8, 200, 1000);
    expect(shallow).toBeGreaterThan(0);
    expect(deep).toBeGreaterThan(shallow);
  });

  it("scrolls backwards near the start", () => {
    expect(autoscrollStep(200 + 8, 200, 1000)).toBeLessThan(0);
  });

  it("runs at full speed past either edge", () => {
    expect(autoscrollStep(1400, 200, 1000)).toBe(AUTOSCROLL_MAX_PX_PER_FRAME);
    expect(autoscrollStep(0, 200, 1000)).toBe(-AUTOSCROLL_MAX_PX_PER_FRAME);
  });
});
