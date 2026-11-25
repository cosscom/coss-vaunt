import "server-only";
import path from "node:path";
import { type DiscoveredPage, projectPages } from "@coss/vaunt-engine/discovery/page-discovery";
import { createFileProjectStore, readAppLogin } from "@coss/vaunt-engine/project-store/file-project-store";
import { isAllowedRecordingHost } from "@coss/vaunt-engine/recording/host-allowlist";
import { DEFAULT_BASE_URL } from "@coss/vaunt-engine/storyboard/storyboard-factories";
import type { Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";

/**
 * Where projects live: `VAUNT_STUDIO_ROOT` (set by `vaunt start`), else `.studio` at the repo root. `next dev` runs
 * from apps/studio, so the repo root is two levels up.
 */
export const STUDIO_ROOT = process.env.VAUNT_STUDIO_ROOT
  ? path.resolve(process.env.VAUNT_STUDIO_ROOT)
  : path.resolve(process.cwd(), "../../.studio");

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
