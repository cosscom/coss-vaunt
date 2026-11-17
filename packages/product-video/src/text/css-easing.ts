import { cubicBezier } from "../easing/cubic-bezier";

export type EasingFunction = (progress: number) => number;

const NAMED_CURVES: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

const STEP_POSITIONS = ["jump-start", "jump-end", "jump-none", "jump-both", "start", "end"] as const;
type StepPosition = (typeof STEP_POSITIONS)[number];

function isStepPosition(value: string): value is StepPosition {
  return (STEP_POSITIONS as readonly string[]).includes(value);
}

function steps(count: number, position: StepPosition): EasingFunction {
  return (progress) => {
    const t = Math.min(1, Math.max(0, progress));
    const step = Math.floor(t * count);
    switch (position) {
      case "jump-start":
      case "start":
        return Math.min(1, (step + 1) / count);
      case "jump-end":
      case "end":
        return Math.min(1, step / count);
      case "jump-none":
        return Math.min(1, step / (count - 1));
      case "jump-both":
        return Math.min(1, (step + 1) / (count + 1));
    }
  };
}

function parseNumbers(argumentList: string): number[] | null {
  const parts = argumentList.split(",").map((part) => part.trim());
  const numbers = parts.map(Number);
  return parts.some((part) => part === "") || numbers.some((value) => !Number.isFinite(value))
    ? null
    : numbers;
}

/** The CSS easing functions the catalogue uses (`linear`, keywords, `cubic-bezier()`, `steps()`), or null. */
export function parseCssEasing(value: string): EasingFunction | null {
  const easing = value.trim().toLowerCase();
  if (easing === "linear") return (progress) => Math.min(1, Math.max(0, progress));
  if (easing === "step-start") return steps(1, "start");
  if (easing === "step-end") return steps(1, "end");
  const named = NAMED_CURVES[easing];
  if (named) return cubicBezier(...named);

  const bezier = /^cubic-bezier\((.*)\)$/.exec(easing);
  if (bezier) {
    const numbers = parseNumbers(bezier[1]);
    if (numbers?.length !== 4) return null;
    const [x1, y1, x2, y2] = numbers;
    if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return null;
    return cubicBezier(x1, y1, x2, y2);
  }

  const stepped = /^steps\(\s*(\d+)\s*(?:,\s*([a-z-]+)\s*)?\)$/.exec(easing);
  if (stepped) {
    const count = Number(stepped[1]);
    const position = stepped[2] ?? "end";
    if (count < 1 || !isStepPosition(position) || (position === "jump-none" && count < 2)) return null;
    return steps(count, position);
  }
  return null;
}

const cache = new Map<string, EasingFunction>();

/** Parsed and cached; throws on an easing `parseCssEasing` rejects, which catalogue validation rules out. */
export function cssEasing(value: string): EasingFunction {
  const cached = cache.get(value);
  if (cached) return cached;
  const parsed = parseCssEasing(value);
  if (!parsed) throw new Error(`Unsupported CSS easing: ${value}`);
  cache.set(value, parsed);
  return parsed;
}
