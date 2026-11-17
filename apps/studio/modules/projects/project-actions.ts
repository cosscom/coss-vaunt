"use server";

import { projectSchema } from "@calcom/product-video/storyboard/storyboard-schema";
import { studioProjectStore } from "./studio-project-store";

const projectId = projectSchema.shape.id;
const projectName = projectSchema.shape.name;

export async function createProjectAction(name: unknown): Promise<{ id: string }> {
  const project = await studioProjectStore.create(projectName.parse(name));
  return { id: project.id };
}

export async function renameProjectAction(id: unknown, name: unknown): Promise<void> {
  await studioProjectStore.rename(projectId.parse(id), projectName.parse(name));
}

export async function deleteProjectAction(id: unknown): Promise<void> {
  await studioProjectStore.delete(projectId.parse(id));
}

export async function saveProjectAction(project: unknown): Promise<{ updatedAt: string }> {
  const saved = await studioProjectStore.save(projectSchema.parse(project));
  return { updatedAt: saved.updatedAt };
}
