import { describe, expect, it } from "vitest";
import { STEP_DISSOLVE_BLUR_PX, stepDissolveFrame } from "./step-dissolve-frame";

describe("stepDissolveFrame", () => {
  it("starts on the old step and ends on the new one, both sharp", () => {
    expect(stepDissolveFrame(0)).toEqual({
      height: 0,
      leaving: { opacity: 1, blur: 0, scale: 1 },
      entering: { opacity: 0, blur: STEP_DISSOLVE_BLUR_PX, scale: 1.02 },
    });
    expect(stepDissolveFrame(1)).toEqual({
      height: 1,
      leaving: { opacity: 0, blur: STEP_DISSOLVE_BLUR_PX, scale: 0.98 },
      entering: { opacity: 1, blur: 0, scale: 1 },
    });
  });

  it("never shows both steps at full strength", () => {
    for (let i = 0; i <= 100; i++) {
      const { leaving, entering } = stepDissolveFrame(i / 100);
      expect(leaving.opacity + entering.opacity).toBeLessThan(1.6);
      expect(Math.min(leaving.opacity, entering.opacity)).toBeLessThan(0.9);
    }
  });
});
