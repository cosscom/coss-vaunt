"use server";

import { newProjectInputSchema } from "@coss/vaunt-engine/project-store/new-project-input";
import { projectSchema } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { studioProjectStore } from "./studio-project-store";

const projectId = projectSchema.shape.id;
const projectName = projectSchema.shape.name;

export async function createProjectAction(input: unknown): Promise<{ id: string }> {
  const { name, setup } = newProjectInputSchema.parse(input);
  const project = await studioProjectStore.create(name, setup);
  return { id: project.id };
}

export async function renameProjectAction(id: unknown, name: unknown): Promise<void> {
  await studioProjectStore.rename(projectId.parse(id), projectName.parse(name));
}

export async function deleteProjectAction(id: unknown): Promise<void> {
  await studioProjectStore.delete(projectId.parse(id));
}

export async function deleteProjectsAction(ids: unknown): Promise<void> {
  const parsed = projectId.array().min(1).parse(ids);
  for (const id of parsed) await studioProjectStore.delete(id);
}

export async function saveProjectAction(project: unknown): Promise<{ updatedAt: string }> {
  const saved = await studioProjectStore.save(projectSchema.parse(project));
  return { updatedAt: saved.updatedAt };
}
