import type { ProjectSetup } from "../storyboard/storyboard-factories";
import type { AspectRatio, Project } from "../storyboard/storyboard-schema";

/** Sign-in details for a custom app: kept beside the project, never in `project.json` or a prompt. */
export type AppLogin = { username: string; password: string };

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
  create(name: string, setup?: ProjectSetup & { login?: AppLogin }): Promise<Project>;
  save(project: Project): Promise<Project>;
  rename(id: string, name: string): Promise<Project | null>;
  delete(id: string): Promise<void>;
}
