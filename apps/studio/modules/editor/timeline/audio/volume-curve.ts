import { audioClipGainAt } from "@calcom/product-video/audio/audio-volume";
import type { AudioClip } from "@calcom/product-video/storyboard/storyboard-schema";

/** The line keeps clear of the clip's top and bottom border so full and silent stay grabbable. */
export const VOLUME_LINE_INSET_PX = 3;
const STEP_PX = 3;

/** Where gain `gain` sits in a clip `height` px tall: full volume at the top. */
export function volumeLineY(gain: number, height: number): number {
  return VOLUME_LINE_INSET_PX + (1 - gain) * (height - VOLUME_LINE_INSET_PX * 2);
}

/** SVG polyline points for the clip's gain (volume × fades) across the visible pixels [from, to). */
export function volumeCurvePoints(
  clip: Pick<AudioClip, "volume" | "duration" | "fadeIn" | "fadeOut">,
  from: number,
  to: number,
  pxPerSecond: number,
  height: number
): string {
  const points: string[] = [];
  const add = (x: number) => {
    const gain = audioClipGainAt(clip, Math.min(clip.duration, x / pxPerSecond));
    points.push(`${x - from},${volumeLineY(gain, height).toFixed(1)}`);
  };
  for (let x = from; x < to; x += STEP_PX) add(x);
  add(to);
  return points.join(" ");
}
