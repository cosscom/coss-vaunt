import "server-only";
import path from "node:path";
import { createFileProjectStore } from "@calcom/product-video/project-store/file-project-store";
import { isAllowedRecordingHost } from "@calcom/product-video/recording/host-allowlist";
import { DEFAULT_BASE_URL } from "@calcom/product-video/storyboard/storyboard-factories";

// `next dev` runs from apps/studio, so the repo root is two levels up.
export const STUDIO_ROOT = path.resolve(process.cwd(), "../../.studio");

export const studioProjectStore = createFileProjectStore(STUDIO_ROOT);

/** The app address new projects start with: `STUDIO_APP_URL` when it's a local address, else the usual Cal.com port. */
export function studioDefaultAppUrl(): string {
  const configured = process.env.STUDIO_APP_URL?.trim();
  return configured && isAllowedRecordingHost(configured) ? configured : DEFAULT_BASE_URL;
}
