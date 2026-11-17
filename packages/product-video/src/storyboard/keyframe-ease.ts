import type { CubicPoints, Ease, EaseName } from "./storyboard-schema";

/** Named eases evaluate as cubic power curves, so they draw as the matching Cubic preset, not CSS keywords. */
const NAMED_CUBICS: Record<Exclude<EaseName, "hold">, CubicPoints> = {
  linear: [0, 0, 1, 1],
  "ease-in": [0.32, 0, 0.67, 0],
  "ease-out": [0.33, 1, 0.68, 1],
  "ease-in-out": [0.65, 0, 0.35, 1],
};

const TOLERANCE = 5e-4;

function formatNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded === 0 ? 0 : rounded);
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The curve an ease draws as, or null for `hold`, which is a step rather than a curve. */
export function easeToCubic(ease: Ease): CubicPoints | null {
  if (typeof ease !== "string") return ease.cubic;
  return ease === "hold" ? null : NAMED_CUBICS[ease];
}

export function sameCubic(a: CubicPoints, b: CubicPoints): boolean {
  return a.every((value, index) => Math.abs(value - b[index]) < TOLERANCE);
}

export function sameEase(a: Ease, b: Ease): boolean {
  if (typeof a === "string" || typeof b === "string") return a === b;
  return sameCubic(a.cubic, b.cubic);
}

/** True when both draw the same curve, so a named ease matches its Cubic preset. */
export function sameCurve(a: Ease, b: Ease): boolean {
  const first = easeToCubic(a);
  const second = easeToCubic(b);
  return first === null || second === null ? first === second : sameCubic(first, second);
}

export function formatCubicBezier(points: CubicPoints): string {
  return `cubic-bezier(${points.map(formatNumber).join(", ")})`;
}

/**
 * Reads `cubic-bezier(a, b, c, d)` or four numbers separated by commas or spaces. x is clamped to [0, 1]
 * and y to [-1, 2], the range a keyframe stores; anything else is null.
 */
export function parseCubicBezier(text: string): CubicPoints | null {
  const trimmed = text.trim().toLowerCase();
  const wrapped = /^cubic-bezier\s*\((.*)\)$/.exec(trimmed);
  const body = (wrapped ? wrapped[1] : trimmed).trim();
  const parts = body.includes(",") ? body.split(",").map((part) => part.trim()) : body.split(/\s+/);
  if (parts.length !== 4 || parts.some((part) => part === "")) return null;
  const numbers = parts.map(Number);
  if (numbers.some((value) => !Number.isFinite(value))) return null;
  const [x1, y1, x2, y2] = numbers;
  return [clamp(x1, 0, 1), clamp(y1, -1, 2), clamp(x2, 0, 1), clamp(y2, -1, 2)];
}
