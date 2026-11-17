import { CONTENT_PADDING_PX } from "../timeline-metrics";
import { roundToGrid } from "../timeline-snapping";

/** Timeline time under a drop at `clientX` on a lane whose left edge is at `laneLeft`, on the 0.1 s grid. */
export function dropTime(clientX: number, laneLeft: number, pxPerSecond: number): number {
  return roundToGrid(Math.max(0, (clientX - laneLeft - CONTENT_PADDING_PX) / pxPerSecond));
}
