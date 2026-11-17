import type { ProjectSettings } from "@calcom/product-video/storyboard/storyboard-schema";

/** The darkest and lightest background swatches, so text matches the video's own palette, not the app's. */
export const INK = "#0b0b0c";
export const PAPER = "#fafafa";

const HEX_COLOR = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const digits = hex.length === 4 ? [...hex.slice(1)].map((d) => d + d).join("") : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((offset) => Number.parseInt(digits.slice(offset, offset + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Text colour that reads on the project background: ink on light backgrounds, paper on dark ones.
 * Falls back to the video theme when the background has no hex colours to judge.
 */
export function textColorForBackground(settings: Pick<ProjectSettings, "background" | "theme">): string {
  const colors = settings.background.value.match(HEX_COLOR) ?? [];
  if (colors.length === 0) return settings.theme === "dark" ? PAPER : INK;
  const average = colors.reduce((sum, color) => sum + luminance(color), 0) / colors.length;
  // 0.18 is where ink and paper have equal contrast against the background.
  return average > 0.18 ? INK : PAPER;
}
