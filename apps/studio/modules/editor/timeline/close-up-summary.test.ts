import { describe, expect, it } from "vitest";
import { closeUpSummary } from "./close-up-summary";

describe("closeUpSummary", () => {
  const drift = {
    focus: { x: 0, y: 0 },
    zoom: 1.6,
    motion: "slide" as const,
    direction: "left" as const,
    intensity: 0.5,
  };

  it("names the zoom, motion and intensity", () => {
    expect(closeUpSummary(drift)).toBe("1.6× · Slide · 50%");
  });

  it("leaves out the intensity when it holds still", () => {
    expect(closeUpSummary({ ...drift, motion: "none", zoom: 2 })).toBe("2× · Still");
  });
});
