import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createProject } from "../storyboard/storyboard-factories";
import { type Project, projectSchema } from "../storyboard/storyboard-schema";
import type { AppLogin, ProjectStore, ProjectSummary } from "./project-store";

const PROJECT_FILE = "project.json";
const APP_LOGIN_FILE = "app-login.json";
const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/i;

async function writeAppLogin(dir: string, login: AppLogin): Promise<void> {
  await writeFile(path.join(dir, APP_LOGIN_FILE), `${JSON.stringify(login)}\n`, { mode: 0o600 });
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export function isProjectId(id: string): boolean {
  return PROJECT_ID_PATTERN.test(id);
}

export function createFileProjectStore(
  rootDir: string,
  { now = () => new Date() }: { now?: () => Date } = {}
): ProjectStore {
  const projectDir = (id: string) => {
    if (!isProjectId(id)) throw new Error(`Invalid project id: ${id}`);
    return path.join(rootDir, id);
  };

  async function get(id: string): Promise<Project | null> {
    if (!isProjectId(id)) return null;
    try {
      const raw = await readFile(path.join(projectDir(id), PROJECT_FILE), "utf8");
      return projectSchema.parse(JSON.parse(raw));
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
  }

  async function write(project: Project): Promise<Project> {
    const validated = projectSchema.parse(project);
    const dir = projectDir(validated.id);
    await mkdir(dir, { recursive: true });
    const target = path.join(dir, PROJECT_FILE);
    const temp = `${target}.${randomUUID()}.tmp`;
    await writeFile(temp, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
    await rename(temp, target);
    return validated;
  }

  async function list(): Promise<ProjectSummary[]> {
    const entries = await readdir(rootDir, { withFileTypes: true }).catch((error: unknown) => {
      if (isMissingFile(error)) return [];
      throw error;
    });
    const projects = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && isProjectId(entry.name))
        .map((entry) => get(entry.name).catch(() => null))
    );
    return projects
      .filter((project): project is Project => project !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((project) => ({
        id: project.id,
        name: project.name,
        updatedAt: project.updatedAt,
        aspectRatio: project.settings.aspectRatio,
        background: project.settings.background.value,
        sceneCount: project.videoTracks.reduce((count, track) => count + track.clips.length, 0),
      }));
  }

  return {
    list,
    get,
    async create(name, setup) {
      const project = await write(
        createProject({
          name,
          now: now(),
          setup: setup && { aspectRatio: setup.aspectRatio, app: setup.app, baseUrl: setup.baseUrl },
        })
      );
      if (setup?.login) await writeAppLogin(projectDir(project.id), setup.login);
      return project;
    },
    save: (project) => write({ ...project, updatedAt: now().toISOString() }),
    async rename(id, name) {
      const project = await get(id);
      if (!project) return null;
      return write({ ...project, name: name.trim(), updatedAt: now().toISOString() });
    },
    async delete(id) {
      await rm(projectDir(id), { recursive: true, force: true });
    },
  };
}
