import { describe, expect, it } from "vitest";
import { cubicBezier } from "./cubic-bezier";

/** Reference: sample the parametric curve densely and read y at the closest x. */
function referenceBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  const point = (t: number, a: number, b: number): number =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let low = 0;
  let high = 1;
  for (let index = 0; index < 200; index++) {
    const mid = (low + high) / 2;
    if (point(mid, x1, x2) < x) low = mid;
    else high = mid;
  }
  return point((low + high) / 2, y1, y2);
}

describe("cubicBezier", () => {
  const curves: [number, number, number, number][] = [
    [0.22, 1, 0.36, 1],
    [0.64, 0, 0.78, 0],
    [0.34, 1.56, 0.64, 1],
    [0.7, 0, 0.84, 0],
    [0.2, 0.8, 0.2, 1],
    [0, 0, 1, 1],
  ];

  it.each(curves)("matches the parametric curve within 1e-5 for (%s, %s, %s, %s)", (x1, y1, x2, y2) => {
    const ease = cubicBezier(x1, y1, x2, y2);
    for (let x = 0; x <= 1.0001; x += 0.01) {
      expect(ease(x)).toBeCloseTo(referenceBezier(x1, y1, x2, y2, Math.min(1, x)), 5);
    }
  });

  it("matches the browser value for CSS `ease` at the midpoint", () => {
    expect(cubicBezier(0.25, 0.1, 0.25, 1)(0.5)).toBeCloseTo(0.8024033877399112, 6);
  });

  it("pins the endpoints and clamps progress outside 0–1", () => {
    const ease = cubicBezier(0.34, 1.56, 0.64, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(-0.5)).toBe(0);
    expect(ease(2)).toBe(1);
  });

  it("overshoots past 1 for a spring-like curve", () => {
    const ease = cubicBezier(0.34, 1.56, 0.64, 1);
    expect(Math.max(...Array.from({ length: 99 }, (_, index) => ease((index + 1) / 100)))).toBeGreaterThan(
      1.05
    );
  });
});
