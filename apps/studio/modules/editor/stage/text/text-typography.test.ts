import { describe, expect, it } from "vitest";
import { textTypography } from "./text-typography";

describe("textTypography", () => {
  it("sizes from the frame's shorter side", () => {
    expect(textTypography("display", "#0b0b0c", { width: 1920, height: 1080 }).fontSize).toBeCloseTo(97.2);
    expect(textTypography("display", "#0b0b0c", { width: 1080, height: 1920 }).fontSize).toBeCloseTo(97.2);
    expect(textTypography("body", "#0b0b0c", { width: 1000, height: 1000 }).fontSize).toBeCloseTo(32);
  });

  it("uses the colour it is given", () => {
    expect(textTypography("title", "#fafafa", { width: 100, height: 100 }).color).toBe("#fafafa");
  });
});
