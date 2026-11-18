import path from "node:path";
import { findProjectStill } from "@calcom/product-video/project-store/project-still";
import type { Metadata } from "next";
import { ProjectsView } from "@/modules/projects/projects-view";
import {
  STUDIO_ROOT,
  studioDefaultAppUrl,
  studioProjectStore,
} from "@/modules/projects/studio-project-store";
import { STUDIO_COPY } from "@/modules/studio-copy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: STUDIO_COPY.projects.title };

export default async function ProjectsPage(): Promise<React.ReactElement> {
  const projects = await studioProjectStore.list();
  const stills = Object.fromEntries(
    await Promise.all(
      projects.map(async ({ id }) => {
        const project = await studioProjectStore.get(id);
        const still = project ? await findProjectStill(path.join(STUDIO_ROOT, id), project) : null;
        return [id, still] as const;
      })
    )
  );
  return <ProjectsView defaultAppUrl={studioDefaultAppUrl()} projects={projects} stills={stills} />;
}
