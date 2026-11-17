import "server-only";
import path from "node:path";
import { createFileProjectStore } from "@calcom/product-video/project-store/file-project-store";

// `next dev` runs from apps/studio, so the repo root is two levels up.
export const STUDIO_ROOT = path.resolve(process.cwd(), "../../.studio");

export const studioProjectStore = createFileProjectStore(STUDIO_ROOT);
