import { sameCubic } from "./keyframe-ease";
import type { CubicPoints } from "./storyboard-schema";

/** The easings.net cubic-bezier approximations of each family. */
const CURVES: Record<EaseFamily, Record<EaseDirection, CubicPoints>> = {
  sine: { in: [0.12, 0, 0.39, 0], out: [0.61, 1, 0.88, 1], "in-out": [0.37, 0, 0.63, 1] },
  quad: { in: [0.11, 0, 0.5, 0], out: [0.5, 1, 0.89, 1], "in-out": [0.45, 0, 0.55, 1] },
  cubic: { in: [0.32, 0, 0.67, 0], out: [0.33, 1, 0.68, 1], "in-out": [0.65, 0, 0.35, 1] },
  quart: { in: [0.5, 0, 0.75, 0], out: [0.25, 1, 0.5, 1], "in-out": [0.76, 0, 0.24, 1] },
  quint: { in: [0.64, 0, 0.78, 0], out: [0.22, 1, 0.36, 1], "in-out": [0.83, 0, 0.17, 1] },
  expo: { in: [0.7, 0, 0.84, 0], out: [0.16, 1, 0.3, 1], "in-out": [0.87, 0, 0.13, 1] },
  circ: { in: [0.55, 0, 1, 0.45], out: [0, 0.55, 0.45, 1], "in-out": [0.85, 0, 0.15, 1] },
  back: { in: [0.36, 0, 0.66, -0.56], out: [0.34, 1.56, 0.64, 1], "in-out": [0.68, -0.6, 0.32, 1.6] },
};

export const EASE_FAMILIES = ["sine", "quad", "cubic", "quart", "quint", "expo", "circ", "back"] as const;
export const EASE_DIRECTIONS = ["in", "out", "in-out"] as const;

export type EaseFamily = (typeof EASE_FAMILIES)[number];
export type EaseDirection = (typeof EASE_DIRECTIONS)[number];
export type EasePreset = { family: EaseFamily; direction: EaseDirection; cubic: CubicPoints };

export const EASE_PRESETS: readonly EasePreset[] = EASE_DIRECTIONS.flatMap((direction) =>
  EASE_FAMILIES.map((family) => ({ family, direction, cubic: CURVES[family][direction] }))
);

export function findEasePreset(cubic: CubicPoints): EasePreset | null {
  return EASE_PRESETS.find((preset) => sameCubic(preset.cubic, cubic)) ?? null;
}
