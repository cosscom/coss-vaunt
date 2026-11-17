import { describe, expect, it } from "vitest";
import { easeLabel } from "./easing-copy";

describe("easeLabel", () => {
  it("names named eases, preset cubics and anything else as custom", () => {
    expect(easeLabel("ease-in-out")).toBe("Ease in and out");
    expect(easeLabel({ cubic: [0.68, -0.6, 0.32, 1.6] })).toBe("Back in out");
    expect(easeLabel({ cubic: [0.2, 0.3, 0.4, 0.5] })).toBe("Custom");
  });
});
