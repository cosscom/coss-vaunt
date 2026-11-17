import type { AnimatedProperty, AspectRatio, Clip } from "../storyboard/storyboard-schema";

export type Size = { width: number; height: number };

export const MIN_CAPTURE_DPR = 1;
export const MAX_CAPTURE_DPR = 4;

/** Pixel size of the exported video per aspect ratio. */
export const OUTPUT_SIZES: Record<AspectRatio, Size> = {
  "9:16": { width: 1080, height: 1920 },
  "4:5": { width: 1080, height: 1350 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1920, height: 1080 },
};

/** Output pixels per CSS pixel when the viewport covers the output frame. */
export function coverScale(viewport: Size, output: Size): number {
  return Math.max(output.width / viewport.width, output.height / viewport.height);
}

function peakValue(property: AnimatedProperty | undefined, fallback: number): number {
  if (!property) return fallback;
  return Math.max(property.value, ...property.keyframes.map((keyframe) => keyframe.value));
}

/** Largest magnification the clip reaches: camera zoom times clip scale. */
export function peakMagnification(clip: Pick<Clip, "properties">): number {
  return peakValue(clip.properties.zoom, 1) * peakValue(clip.properties.scale, 1);
}

export type CaptureDpr = {
  dpr: number;
  /** Source pixels the peak pose needs per CSS pixel; above `MAX_CAPTURE_DPR` the pose is flagged. */
  required: number;
  exceedsBudget: boolean;
};

/** The smallest integer DPR at which the composition never upsamples a recorded frame. */
export function captureDpr({
  aspectRatio,
  viewport,
  clip,
}: {
  aspectRatio: AspectRatio;
  viewport: Size;
  clip: Pick<Clip, "properties">;
}): CaptureDpr {
  const required = coverScale(viewport, OUTPUT_SIZES[aspectRatio]) * peakMagnification(clip);
  const dpr = Math.min(MAX_CAPTURE_DPR, Math.max(MIN_CAPTURE_DPR, Math.ceil(required - 1e-9)));
  return { dpr, required, exceedsBudget: required > MAX_CAPTURE_DPR + 1e-9 };
}
