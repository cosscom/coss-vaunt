import type { AspectRatio, Project } from "../storyboard/storyboard-schema";

export type ProjectSummary = {
  id: string;
  name: string;
  updatedAt: string;
  aspectRatio: AspectRatio;
  /** CSS background of the video, for thumbnails. */
  background: string;
  sceneCount: number;
};

export interface ProjectStore {
  list(): Promise<ProjectSummary[]>;
  get(id: string): Promise<Project | null>;
  create(name: string): Promise<Project>;
  save(project: Project): Promise<Project>;
  rename(id: string, name: string): Promise<Project | null>;
  delete(id: string): Promise<void>;
}
