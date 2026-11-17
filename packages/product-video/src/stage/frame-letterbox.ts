import type { AspectRatio } from "../storyboard/storyboard-schema";

export type Size = { width: number; height: number };

export function aspectRatioSize(ratio: AspectRatio): Size {
  const [width, height] = ratio.split(":").map(Number);
  return { width: width ?? 1, height: height ?? 1 };
}

/** The largest frame of `target`'s shape that fits inside `container` minus `padding` on every side, centred. */
export function letterbox(container: Size, target: Size, padding = 0): Size & { x: number; y: number } {
  const available = {
    width: Math.max(0, container.width - padding * 2),
    height: Math.max(0, container.height - padding * 2),
  };
  const scale = Math.min(available.width / target.width, available.height / target.height);
  const width = Math.floor(target.width * scale);
  const height = Math.floor(target.height * scale);
  return {
    width,
    height,
    x: Math.round((container.width - width) / 2),
    y: Math.round((container.height - height) / 2),
  };
}
