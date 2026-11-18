import type { LayerGeometry } from "@calcom/product-video/stage/camera-projection";
import { videoClipAt } from "@calcom/product-video/stage/clip-picking";
import type { Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { activeClipsAt } from "@calcom/product-video/storyboard/track-resolution";

export type FrameRect = { x: number; y: number; width: number; height: number };

/** Text layers drawn in the frame, topmost first, with their boxes in frame CSS px; faded-out text is skipped. */
function textLayers(frameElement: HTMLElement): Array<{ clipId: string; rect: FrameRect }> {
  const origin = frameElement.getBoundingClientRect();
  return [...frameElement.querySelectorAll<HTMLElement>("[data-stage-clip-id]")]
    .filter((element) => Number(element.style.opacity || 1) > 0.05)
    .reverse()
    .map((element) => {
      const box = element.getBoundingClientRect();
      return {
        clipId: element.dataset.stageClipId ?? "",
        rect: { x: box.left - origin.left, y: box.top - origin.top, width: box.width, height: box.height },
      };
    });
}

export function textRectFor(frameElement: HTMLElement, clipId: string): FrameRect | null {
  return textLayers(frameElement).find((layer) => layer.clipId === clipId)?.rect ?? null;
}

/** The clip drawn under a frame point (CSS px): text first, as it sits above every device. */
export function clipAtPoint({
  frameElement,
  project,
  time,
  layerAt,
  x,
  y,
}: {
  frameElement: HTMLElement;
  project: Project;
  time: number;
  layerAt: (clipId: string) => LayerGeometry | null;
  x: number;
  y: number;
}): string | null {
  const text = textLayers(frameElement).find(
    ({ rect }) => x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
  );
  return text?.clipId ?? videoClipAt(activeClipsAt(project, time), layerAt, x, y);
}
