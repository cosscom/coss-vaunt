import path from "node:path";
import { findProjectStill } from "@coss/vaunt-engine/project-store/project-still";
import type { Metadata } from "next";
import { StudioIntro } from "@/modules/intro/studio-intro";
import { FirstRun } from "@/modules/onboarding/first-run";
import { onboardingCompleted } from "@/modules/onboarding/onboarding-store";
import { ProjectsView } from "@/modules/projects/projects-view";
import {
  STUDIO_ROOT,
  studioDefaultAppUrl,
  studioProjectStore,
} from "@/modules/projects/studio-project-store";
import { STUDIO_COPY } from "@/modules/studio-copy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: STUDIO_COPY.projects.title };

/** `/?onboarding` shows the onboarding again, for a second look or a recording. */
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const replay = "onboarding" in (await searchParams);
  const firstRun = replay || !(await onboardingCompleted());
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
  const studio = <ProjectsView defaultAppUrl={studioDefaultAppUrl()} projects={projects} stills={stills} />;
  return firstRun ? (
    <FirstRun>{studio}</FirstRun>
  ) : (
    <>
      <StudioIntro />
      {studio}
    </>
  );
}
