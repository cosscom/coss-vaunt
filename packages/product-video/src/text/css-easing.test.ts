import { describe, expect, it } from "vitest";
import { cssEasing, parseCssEasing } from "./css-easing";

describe("parseCssEasing", () => {
  it("holds steps(1, end) at 0 until the very end", () => {
    const ease = cssEasing("steps(1, end)");
    expect(ease(0)).toBe(0);
    expect(ease(0.999)).toBe(0);
    expect(ease(1)).toBe(1);
  });

  it("jumps steps(1, start) to 1 immediately", () => {
    expect(cssEasing("steps(1, start)")(0)).toBe(1);
  });

  it("splits steps(4) into quarters, defaulting to end", () => {
    const ease = cssEasing("steps(4)");
    expect([0.1, 0.3, 0.6, 0.8, 1].map(ease)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it("reads keywords and cubic-bezier with any spacing", () => {
    expect(cssEasing("linear")(0.3)).toBeCloseTo(0.3);
    expect(cssEasing("ease")(0.5)).toBeCloseTo(cssEasing("cubic-bezier(0.25,0.1,0.25,1)")(0.5));
    expect(cssEasing("cubic-bezier( 0.4 , 0 , 1 , 1 )")(1)).toBe(1);
  });

  it.each([
    "bounce",
    "cubic-bezier(1.2, 0, 0, 1)",
    "cubic-bezier(0, 0, 1)",
    "steps(0)",
    "steps(1, jump-none)",
    "spring(1)",
  ])("rejects %s", (value) => {
    expect(parseCssEasing(value)).toBeNull();
  });
});
