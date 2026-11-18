import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRecordingClip } from "../storyboard/storyboard-factories";
import type { Project } from "../storyboard/storyboard-schema";
import { createFileProjectStore } from "./file-project-store";

function withClips(project: Project, clips: Project["videoTracks"][number]["clips"]): Project {
  return { ...project, videoTracks: [{ ...project.videoTracks[0], clips }] };
}

describe("createFileProjectStore", () => {
  let rootDir: string;
  let clock: number;
  const now = () => new Date(clock);

  beforeEach(async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), "product-video-store-"));
    clock = Date.parse("2026-11-17T10:00:00Z");
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it("lists nothing when the root does not exist yet", async () => {
    const store = createFileProjectStore(path.join(rootDir, "missing"), { now });
    expect(await store.list()).toEqual([]);
  });

  it("creates a project as <root>/<id>/project.json", async () => {
    const store = createFileProjectStore(rootDir, { now });
    const project = await store.create("Main agent launch");
    const raw = JSON.parse(await readFile(path.join(rootDir, project.id, "project.json"), "utf8"));
    expect(raw).toEqual(project);
    expect(await store.get(project.id)).toEqual(project);
  });

  it("creates with the dialog's setup and keeps the app's login out of project.json", async () => {
    const store = createFileProjectStore(rootDir, { now });
    const project = await store.create("Demo", {
      aspectRatio: "9:16",
      app: { kind: "custom", instructions: "The dashboard is at /app" },
      baseUrl: "http://localhost:3000",
      login: { username: "demo@example.com", password: "demo-password" },
    });
    expect(project.settings).toMatchObject({
      aspectRatio: "9:16",
      app: { kind: "custom", instructions: "The dashboard is at /app" },
      baseUrl: "http://localhost:3000",
    });
    const dir = path.join(rootDir, project.id);
    expect(await readFile(path.join(dir, "project.json"), "utf8")).not.toContain("demo-password");
    expect(JSON.parse(await readFile(path.join(dir, "app-login.json"), "utf8"))).toEqual({
      username: "demo@example.com",
      password: "demo-password",
    });
    expect((await stat(path.join(dir, "app-login.json"))).mode & 0o777).toBe(0o600);
  });

  it("saves edits, bumps updatedAt and leaves no temp files", async () => {
    const store = createFileProjectStore(rootDir, { now });
    const project = await store.create("Launch");
    clock += 60_000;
    const clip = createRecordingClip({ name: "Clip 1", route: "/home" });
    const saved = await store.save(withClips(project, [clip]));

    expect(saved.updatedAt).toBe("2026-11-17T10:01:00.000Z");
    expect((await store.get(project.id))?.videoTracks[0]?.clips).toEqual([clip]);
    expect(await readdir(path.join(rootDir, project.id))).toEqual(["project.json"]);
  });

  it("refuses to save an invalid project", async () => {
    const store = createFileProjectStore(rootDir, { now });
    const project = await store.create("Launch");
    const clip = { ...createRecordingClip({ name: "Long", route: "/home" }), duration: 9 };
    await expect(store.save(withClips(project, [clip]))).rejects.toThrow();
    expect((await store.get(project.id))?.videoTracks[0]?.clips).toEqual([]);
  });

  it("lists summaries newest first", async () => {
    const store = createFileProjectStore(rootDir, { now });
    const older = await store.create("Older");
    clock += 1000;
    const newer = await store.create("Newer");

    expect(await store.list()).toEqual([
      {
        id: newer.id,
        name: "Newer",
        updatedAt: newer.updatedAt,
        aspectRatio: "16:9",
        background: "#0b0b0c",
        sceneCount: 0,
      },
      {
        id: older.id,
        name: "Older",
        updatedAt: older.updatedAt,
        aspectRatio: "16:9",
        background: "#0b0b0c",
        sceneCount: 0,
      },
    ]);
  });

  it("skips a corrupt project in the list", async () => {
    const store = createFileProjectStore(rootDir, { now });
    const project = await store.create("Good");
    const broken = await store.create("Broken");
    await writeFile(path.join(rootDir, broken.id, "project.json"), "{", "utf8");
    expect((await store.list()).map((summary) => summary.id)).toEqual([project.id]);
  });

  it("renames and deletes", async () => {
    const store = createFileProjectStore(rootDir, { now });
    const project = await store.create("Draft");
    expect((await store.rename(project.id, "  Final  "))?.name).toBe("Final");
    expect(await store.rename("unknown", "Nope")).toBeNull();

    await store.delete(project.id);
    expect(await store.get(project.id)).toBeNull();
    expect(await store.list()).toEqual([]);
  });

  it("never resolves an id outside the root", async () => {
    const store = createFileProjectStore(rootDir, { now });
    expect(await store.get("../etc")).toBeNull();
    await expect(store.delete("../etc")).rejects.toThrow("Invalid project id");
  });
});
