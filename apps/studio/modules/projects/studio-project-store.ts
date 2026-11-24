import "server-only";
import path from "node:path";
import { type DiscoveredPage, projectPages } from "@calcom/product-video/discovery/page-discovery";
import { createFileProjectStore, readAppLogin } from "@calcom/product-video/project-store/file-project-store";
import { isAllowedRecordingHost } from "@calcom/product-video/recording/host-allowlist";
import { DEFAULT_BASE_URL } from "@calcom/product-video/storyboard/storyboard-factories";
import type { Project } from "@calcom/product-video/storyboard/storyboard-schema";

// `next dev` runs from apps/studio, so the repo root is two levels up.
export const STUDIO_ROOT = path.resolve(process.cwd(), "../../.studio");

export const studioProjectStore = createFileProjectStore(STUDIO_ROOT);

/** The app address new projects start with: `STUDIO_APP_URL` when it's a local address, else Next.js's default port. */
export function studioDefaultAppUrl(): string {
  const configured = process.env.STUDIO_APP_URL?.trim();
  return configured && isAllowedRecordingHost(configured) ? configured : DEFAULT_BASE_URL;
}

/** The pages found by crawling the project's app, signed in with its test login; none for a files-only project. */
export async function studioProjectPages(project: Project): Promise<DiscoveredPage[]> {
  if (project.settings.app?.kind === "none") return [];
  const projectDir = path.join(STUDIO_ROOT, project.id);
  return projectPages({
    projectDir,
    baseUrl: project.settings.baseUrl,
    login: await readAppLogin(projectDir),
  });
}
