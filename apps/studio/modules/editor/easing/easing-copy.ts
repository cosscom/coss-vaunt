import {
  type EaseDirection,
  type EaseFamily,
  findEasePreset,
} from "@coss/vaunt-engine/storyboard/ease-presets";
import type { Ease } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { STUDIO_COPY } from "../../studio-copy";

const FAMILIES: Record<EaseFamily, string> = {
  sine: "Sine",
  quad: "Quad",
  cubic: "Cubic",
  quart: "Quart",
  quint: "Quint",
  expo: "Expo",
  circ: "Circ",
  back: "Back",
};

export const EASING_COPY = {
  title: "Easing",
  empty: "Select keyframes to edit their easing.",
  hint: "Shapes the motion into each selected keyframe.",
  mixed: "Mixed",
  custom: "Custom",
  directions: { in: "Ease in", out: "Ease out", "in-out": "Ease in out" } satisfies Record<
    EaseDirection,
    string
  >,
  presets: "Presets",
  graph: "Easing curve",
  time: "Time",
  progress: "Progress",
  handle: (index: 1 | 2, x: string, y: string) => `Handle ${index}, time ${x}, progress ${y}`,
  handleDescription: "Arrow keys move the handle; hold Shift for larger steps.",
  input: "Cubic bezier",
  invalid: "Enter four numbers, like 0.42, 0, 0.58, 1.",
  play: (name: string) => `Preview ${name}`,
  preset: (family: EaseFamily, direction: EaseDirection) =>
    `${FAMILIES[family]} ${direction === "in-out" ? "in out" : direction}`,
} as const;

/** A named ease's own name, a preset's name for a matching cubic, or Custom. */
export function easeLabel(ease: Ease): string {
  if (typeof ease === "string") return STUDIO_COPY.eases[ease];
  const preset = findEasePreset(ease.cubic);
  return preset ? EASING_COPY.preset(preset.family, preset.direction) : EASING_COPY.custom;
}
