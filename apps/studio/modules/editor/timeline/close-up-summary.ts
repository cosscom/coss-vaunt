import type { Drift } from "@calcom/product-video/storyboard/storyboard-schema";
import { STUDIO_COPY } from "../../studio-copy";

/** "1.6× · Slide · 50%": what the close-up does, short enough for a lane. */
export function closeUpSummary(drift: Drift): string {
  const parts = [`${Number(drift.zoom.toFixed(1))}×`, STUDIO_COPY.drift.motions[drift.motion]];
  if (drift.motion !== "none") parts.push(`${Math.round(drift.intensity * 100)}%`);
  return parts.join(" · ");
}
