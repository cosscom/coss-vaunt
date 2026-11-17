import { describe, expect, it } from "vitest";
import { findEasePreset } from "./ease-presets";
import { easeToCubic, formatCubicBezier, parseCubicBezier, sameCurve, sameEase } from "./keyframe-ease";
import { applyEase, evaluateProperty } from "./property-evaluation";
import { keyframeSchema } from "./storyboard-schema";

describe("easeToCubic", () => {
  it("draws named eases as the cubic curves they evaluate as", () => {
    expect(easeToCubic("linear")).toEqual([0, 0, 1, 1]);
    expect(easeToCubic("ease-in")).toEqual([0.32, 0, 0.67, 0]);
    expect(findEasePreset(easeToCubic("ease-in-out") ?? [0, 0, 1, 1])).toMatchObject({
      family: "cubic",
      direction: "in-out",
    });
  });

  it("has no curve for hold and returns a custom cubic as stored", () => {
    expect(easeToCubic("hold")).toBeNull();
    expect(easeToCubic({ cubic: [0.1, 0.2, 0.3, 0.4] })).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it("keeps each named ease within a couple of percent of its curve", () => {
    for (const name of ["ease-in", "ease-out", "ease-in-out"] as const) {
      const cubic = easeToCubic(name);
      if (!cubic) throw new Error(name);
      for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
        expect(Math.abs(applyEase(name, t) - applyEase({ cubic }, t))).toBeLessThan(0.03);
      }
    }
  });
});

describe("applyEase with a cubic", () => {
  it("matches the CSS curve and pins the ends", () => {
    const easeInOut = { cubic: [0.42, 0, 0.58, 1] as [number, number, number, number] };
    expect(applyEase(easeInOut, 0.5)).toBeCloseTo(0.5);
    expect(applyEase(easeInOut, 0.25)).toBeCloseTo(0.129, 2);
    expect(applyEase(easeInOut, 0)).toBe(0);
    expect(applyEase(easeInOut, 1)).toBe(1);
  });

  it("overshoots past the target for a back curve", () => {
    const back = { cubic: [0.34, 1.56, 0.64, 1] as [number, number, number, number] };
    expect(applyEase(back, 0.6)).toBeGreaterThan(1);
  });

  it("eases a property segment by the later keyframe's cubic", () => {
    const property = {
      value: 0,
      keyframes: [
        { id: "a", at: 0, value: 0, ease: "linear" as const },
        { id: "b", at: 2, value: 10, ease: { cubic: [0.42, 0, 1, 1] as [number, number, number, number] } },
      ],
    };
    expect(evaluateProperty(property, 1)).toBeCloseTo(10 * applyEase(property.keyframes[1].ease, 0.5));
    expect(evaluateProperty(property, 1)).toBeLessThan(5);
  });
});

describe("keyframe schema", () => {
  it("accepts named eases and in-range cubics, and rejects x outside [0, 1]", () => {
    expect(keyframeSchema.safeParse({ id: "k", at: 0, value: 0, ease: "hold" }).success).toBe(true);
    expect(
      keyframeSchema.safeParse({ id: "k", at: 0, value: 0, ease: { cubic: [0.68, -0.6, 0.32, 1.6] } }).success
    ).toBe(true);
    expect(
      keyframeSchema.safeParse({ id: "k", at: 0, value: 0, ease: { cubic: [1.2, 0, 0.5, 1] } }).success
    ).toBe(false);
  });
});

describe("sameEase", () => {
  it("compares names exactly and cubics within rounding", () => {
    expect(sameEase("ease-in", "ease-in")).toBe(true);
    expect(sameEase("ease-in", { cubic: [0.32, 0, 0.67, 0] })).toBe(false);
    expect(sameEase({ cubic: [0.1, 0, 0.5, 1] }, { cubic: [0.1001, 0, 0.5, 1] })).toBe(true);
  });
});

describe("sameCurve", () => {
  it("matches a named ease with its cubic and hold only with hold", () => {
    expect(sameCurve("ease-in", { cubic: [0.32, 0, 0.67, 0] })).toBe(true);
    expect(sameCurve("linear", { cubic: [0, 0, 1, 1] })).toBe(true);
    expect(sameCurve("hold", "hold")).toBe(true);
    expect(sameCurve("hold", "linear")).toBe(false);
  });
});

describe("formatCubicBezier", () => {
  it("writes CSS with trimmed numbers", () => {
    expect(formatCubicBezier([0.42, 0, 0.58, 1])).toBe("cubic-bezier(0.42, 0, 0.58, 1)");
    expect(formatCubicBezier([1 / 3, -0, 0.123456, 1.5])).toBe("cubic-bezier(0.333, 0, 0.123, 1.5)");
  });
});

describe("parseCubicBezier", () => {
  it("reads the CSS function with any spacing or case", () => {
    expect(parseCubicBezier("cubic-bezier(0.42, 0, 0.58, 1)")).toEqual([0.42, 0, 0.58, 1]);
    expect(parseCubicBezier("  Cubic-Bezier( .1 ,.2,.3 , .4 ) ")).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it("reads four bare numbers separated by commas or spaces", () => {
    expect(parseCubicBezier("0.1, 0.2, 0.3, 0.4")).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(parseCubicBezier("0.1 0.2   0.3 0.4")).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it("clamps x to [0, 1] and y to the stored range", () => {
    expect(parseCubicBezier("1.5, 3, -0.2, -4")).toEqual([1, 2, 0, -1]);
  });

  it.each([
    "",
    "ease-in",
    "cubic-bezier(0, 0, 1)",
    "0, 0, 1, 1, 1",
    "0,,1,1",
    "a, b, c, d",
    "cubic-bezier(0 0 1 1",
  ])("rejects %j", (input) => {
    expect(parseCubicBezier(input)).toBeNull();
  });
});

describe("findEasePreset", () => {
  it("names a preset curve and leaves others custom", () => {
    expect(findEasePreset([0.34, 1.56, 0.64, 1])).toMatchObject({ family: "back", direction: "out" });
    expect(findEasePreset([0.2, 0.3, 0.4, 0.5])).toBeNull();
  });
});
