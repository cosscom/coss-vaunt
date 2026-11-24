import type { TEXT_SIZES } from "@coss/vaunt-engine/storyboard/storyboard-schema";

type TextSize = (typeof TEXT_SIZES)[number];

/** Font size as a fraction of the frame's shorter side, so portrait frames don't get oversized titles. */
const SIZE_RATIOS: Record<TextSize, number> = { display: 0.09, title: 0.06, body: 0.032 };
const LINE_HEIGHTS: Record<TextSize, number> = { display: 1.02, title: 1.1, body: 1.3 };

/** Text wraps inside this share of the frame width. */
export const TEXT_MAX_WIDTH_RATIO = 0.84;

export type TextTypography = { fontSize: number; lineHeight: number; color: string; maxWidth: number };

export function textTypography(
  size: TextSize,
  color: string,
  frame: { width: number; height: number }
): TextTypography {
  return {
    fontSize: SIZE_RATIOS[size] * Math.min(frame.width, frame.height),
    lineHeight: LINE_HEIGHTS[size],
    color,
    maxWidth: frame.width * TEXT_MAX_WIDTH_RATIO,
  };
}
