import type { AspectRatio } from "@calcom/product-video/storyboard/storyboard-schema";

/** `16:9` → `16 / 9`, for the CSS `aspect-ratio` property. */
export function cssAspectRatio(ratio: AspectRatio): string {
  return ratio.replace(":", " / ");
}
