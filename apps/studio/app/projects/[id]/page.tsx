import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditorView } from "@/modules/editor/editor-view";
import { studioProjectStore } from "@/modules/projects/studio-project-store";

type ProjectPageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const project = await studioProjectStore.get((await params).id);
  return { title: project?.name };
}

export default async function ProjectPage({ params }: ProjectPageProps): Promise<React.ReactElement> {
  const project = await studioProjectStore.get((await params).id);
  if (!project) notFound();
  return <EditorView initialProject={project} />;
}
