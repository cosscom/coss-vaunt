import {
  MOTION_PLACEMENTS,
  type MotionPlacement,
} from "@coss/vaunt-engine/catalogues/motion-presets/apply-motion-preset";
import { findMotionPreset } from "@coss/vaunt-engine/catalogues/motion-presets/motion-presets";

/** Drag data type for a motion preset from the motion pane, dropped onto a timeline clip. */
export const MOTION_DRAG_TYPE = "application/x-studio-motion";

export type MotionDrop = { presetId: string; placement: MotionPlacement };

export function hasMotionDrag(transfer: { types: readonly string[] }): boolean {
  return transfer.types.includes(MOTION_DRAG_TYPE);
}

export function serializeMotionDrag(drop: MotionDrop): string {
  return JSON.stringify(drop);
}

export function parseMotionDrag(data: string): MotionDrop | null {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { presetId, placement } = value as Record<string, unknown>;
  if (typeof presetId !== "string" || !findMotionPreset(presetId)) return null;
  const known = MOTION_PLACEMENTS.find((candidate) => candidate === placement);
  return known ? { presetId, placement: known } : null;
}
