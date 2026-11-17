import type { AssetTemplate } from "@calcom/product-video/project-store/project-assets";
import { audioClipSchema, clipSchema } from "@calcom/product-video/storyboard/storyboard-schema";

/** Drag data type for an asset from the assets pane; files from the desktop arrive as `Files` instead. */
export const ASSET_DRAG_TYPE = "application/x-studio-asset";

type DragTypes = { types: readonly string[] };

export function hasAssetDrag(transfer: DragTypes): boolean {
  return transfer.types.includes(ASSET_DRAG_TYPE);
}

export function serializeAssetDrag(template: AssetTemplate): string {
  return JSON.stringify(template);
}

/** The dropped asset as a new clip with a fresh id, or null when the drop wasn't one (or is for the other kind of track). */
export function parseAssetDrag(
  data: string,
  track: AssetTemplate["kind"],
  newId: () => string = () => crypto.randomUUID()
): AssetTemplate | null {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || !("kind" in value) || !("clip" in value)) return null;
  if (value.kind !== track) return null;
  if (track === "video") {
    const clip = clipSchema.safeParse(value.clip);
    return clip.success
      ? { kind: "video", clip: { ...clip.data, id: newId(), storyboardNodeId: undefined } }
      : null;
  }
  const clip = audioClipSchema.safeParse(value.clip);
  return clip.success ? { kind: "audio", clip: { ...clip.data, id: newId() } } : null;
}
