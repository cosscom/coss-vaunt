import { parseBackgroundGradient } from "@coss/vaunt-engine/stage/background-gradient";
import type { ProjectSettings } from "@coss/vaunt-engine/storyboard/storyboard-schema";

type Background = ProjectSettings["background"];

/** What the background picker edits: one colour, or a two-stop linear gradient at an angle. */
export type BackgroundFill =
  | { kind: "color"; color: string }
  | { kind: "gradient"; from: string; to: string; angle: number };

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `#abc`, `abc` and `#AABBCC` as `#aabbcc`; null for anything that isn't a hex colour. */
export function normalizeHex(value: string): string | null {
  const match = HEX.exec(value.trim());
  if (!match?.[1]) return null;
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
  return `#${digits.toLowerCase()}`;
}

/** `color` mixed toward black by `amount` (0–1), for a gradient made from a solid colour. */
export function shade(color: string, amount: number): string {
  const hex = normalizeHex(color) ?? "#000000";
  const channel = (index: number) =>
    Math.round(Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) * (1 - amount))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/** `color` mixed toward white by `amount` (0–1). */
export function tint(color: string, amount: number): string {
  const hex = normalizeHex(color) ?? "#000000";
  const channel = (index: number) => {
    const value = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
    return Math.round(value + (255 - value) * amount)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/** A second stop that reads against `color`: darker for a light colour, lighter for a dark one. */
export function partnerStop(color: string): string {
  const hex = normalizeHex(color) ?? "#000000";
  const [r, g, b] = [0, 1, 2].map(
    (index) => Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255
  );
  const luminance = 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
  return luminance > 0.5 ? shade(hex, 0.25) : tint(hex, 0.18);
}

export function gradientCss(fill: { from: string; to: string; angle: number }): string {
  return `linear-gradient(${Math.round(fill.angle)}deg, ${fill.from} 0%, ${fill.to} 100%)`;
}

export function toBackground(fill: BackgroundFill): Background {
  return fill.kind === "color"
    ? { kind: "color", value: fill.color }
    : { kind: "gradient", value: gradientCss(fill) };
}

/**
 * The picker's view of a saved background. A gradient keeps its first and last stops (a radial one reads as a
 * vertical linear one); `toHex` turns colours that aren't hex (`rgb(…)`, names) into hex for the colour inputs.
 */
export function readBackground(
  background: Background,
  toHex: (color: string) => string = (c) => c
): BackgroundFill {
  if (background.kind === "color") return { kind: "color", color: toHex(background.value) };
  const gradient = parseBackgroundGradient(background.value);
  const first = gradient?.stops[0]?.color ?? "#27272a";
  const last = gradient?.stops[gradient.stops.length - 1]?.color ?? "#050506";
  return {
    kind: "gradient",
    from: toHex(first),
    to: toHex(last),
    angle: gradient?.kind === "linear" ? gradient.angle : 180,
  };
}
