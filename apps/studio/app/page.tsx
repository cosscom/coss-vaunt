import type { Metadata } from "next";
import { ProjectsView } from "@/modules/projects/projects-view";
import { studioProjectStore } from "@/modules/projects/studio-project-store";
import { STUDIO_COPY } from "@/modules/studio-copy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: STUDIO_COPY.projects.title };

export default async function ProjectsPage(): Promise<React.ReactElement> {
  return <ProjectsView projects={await studioProjectStore.list()} />;
}
