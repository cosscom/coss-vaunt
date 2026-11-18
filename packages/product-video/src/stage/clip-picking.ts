import type { ActiveClip } from "../storyboard/track-resolution";
import { devicePoint, frameToDevice, type LayerGeometry, projectToFrame } from "./camera-projection";

type LayerAt = (clipId: string) => LayerGeometry | null;

/** The device's corners in frame CSS px, clockwise from top left, as the stage drew it. */
export function deviceOutline(geometry: LayerGeometry): Array<[number, number]> {
  return (
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const
  ).map(([x, y]) => {
    const point = projectToFrame(geometry, devicePoint(geometry, x, y));
    return [point.x, point.y];
  });
}

/**
 * The topmost video clip whose device is under a frame point (CSS px), from where the stage last drew each
 * one; null over the background. Text sits above every device and is hit-tested where it's rendered.
 */
export function videoClipAt(active: ActiveClip[], layerAt: LayerAt, x: number, y: number): string | null {
  for (const entry of [...active].reverse()) {
    if (entry.clip.source.kind === "text") continue;
    const geometry = layerAt(entry.clip.id);
    const hit = geometry ? frameToDevice(geometry, x, y) : null;
    if (hit && Math.abs(hit[0]) <= 1 && Math.abs(hit[1]) <= 1) return entry.clip.id;
  }
  return null;
}
