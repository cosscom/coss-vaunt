import { cubicBezier } from "../easing/cubic-bezier";
import { PROPERTY_KEYS, PROPERTY_SPECS, type PropertyKey } from "./property-specs";
import type { AnimatedProperty, Clip, CubicPoints, Ease } from "./storyboard-schema";

export type PropertyValues = Record<PropertyKey, number>;

const solvedCubics = new WeakMap<CubicPoints, (progress: number) => number>();

function solveCubic(points: CubicPoints): (progress: number) => number {
  let solved = solvedCubics.get(points);
  if (!solved) {
    solved = cubicBezier(...points);
    solvedCubics.set(points, solved);
  }
  return solved;
}

export function applyEase(ease: Ease, progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  if (typeof ease !== "string") return solveCubic(ease.cubic)(t);
  switch (ease) {
    case "linear":
      return t;
    case "ease-in":
      return t * t * t;
    case "ease-out":
      return 1 - (1 - t) ** 3;
    case "ease-in-out":
      return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    case "hold":
      return t < 1 ? 0 : 1;
  }
}

/** Value at `time` seconds into the clip: static without keyframes, held outside them, eased between. */
export function evaluateProperty(property: AnimatedProperty, time: number): number {
  const keyframes = [...property.keyframes].sort((a, b) => a.at - b.at);
  if (keyframes.length === 0) return property.value;
  const first = keyframes[0];
  if (time <= first.at) return first.value;
  for (let index = 1; index < keyframes.length; index++) {
    const next = keyframes[index];
    if (time > next.at) continue;
    const previous = keyframes[index - 1];
    const span = next.at - previous.at;
    const progress = span === 0 ? 1 : (time - previous.at) / span;
    return previous.value + (next.value - previous.value) * applyEase(next.ease, progress);
  }
  return keyframes[keyframes.length - 1].value;
}

export function evaluateClipProperties(clip: Pick<Clip, "properties">, time: number): PropertyValues {
  const values = {} as PropertyValues;
  for (const key of PROPERTY_KEYS) {
    const property = clip.properties[key];
    values[key] = property ? evaluateProperty(property, time) : PROPERTY_SPECS[key].defaultValue;
  }
  return values;
}
