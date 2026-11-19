import { createProject, createRecordingClip } from "@calcom/product-video/storyboard/storyboard-factories";
import type { Clip, Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFrameSourcePool } from "./frame-source-pool";
import { recordingTakesFor } from "./recording-lookup";

const fakeSource = (label: string) => ({
  label,
  texture: {},
  size: { width: 1, height: 1 },
  show: () => undefined,
  prepare: () => Promise.resolve(),
  idle: () => undefined,
  dispose: () => undefined,
});

vi.mock("./placeholder-frame-source", () => ({
  createPlaceholderFrameSource: () => fakeSource("placeholder"),
}));
vi.mock("./recording-frame-source", () => ({
  createRecordingFrameSource: ({ recording }: { recording: { hash: string } }) =>
    fakeSource(`take:${recording.hash}`),
}));
vi.mock("./video-frame-source", () => ({ createVideoFrameSource: () => fakeSource("video") }));
vi.mock("./image-frame-source", () => ({ createImageFrameSource: () => fakeSource("image") }));

const clip: Clip = { ...createRecordingClip({ name: "Home", route: "/home", duration: 4 }), id: "c" };
const projectWith = (clips: Clip[]): Project => {
  const project = createProject({ name: "Pool", now: new Date(Date.UTC(2026, 10, 19)) });
  return { ...project, id: "p", videoTracks: [{ ...project.videoTracks[0], clips }] };
};
const hashOf = (project: Project, candidate: Clip) => recordingTakesFor(project, candidate)?.hashes[0] ?? "";

/** A project folder: the takes each clip has on disk, newest first. */
function stubDisk(takes: Record<string, string[]>) {
  const fetchMock = vi.fn(async (url: string) => {
    const listing = url.match(/\/recordings\/([^/]+)$/);
    if (listing) {
      const entries = (takes[listing[1]] ?? []).map((name) => ({ name, directory: true }));
      return new Response(JSON.stringify({ entries }));
    }
    const manifest = url.match(/\/recordings\/([^/]+)\/([^/]+)\/manifest\.json$/);
    if (manifest && takes[manifest[1]]?.includes(manifest[2]))
      return new Response(JSON.stringify({ captureHash: manifest[2], video: { file: "proxy.mp4" } }));
    return new Response("Not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const label = (pool: ReturnType<typeof createFrameSourcePool>, clipId: string) => {
  const source = pool.get(clipId);
  return source && "label" in source ? source.label : undefined;
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createFrameSourcePool", () => {
  let pool: ReturnType<typeof createFrameSourcePool>;
  beforeEach(() => {
    pool = createFrameSourcePool({
      maxAnisotropy: 1,
      placeholderLabel: "Not recorded yet",
      onFrame: () => {},
    });
  });
  afterEach(() => {
    pool.dispose();
    vi.unstubAllGlobals();
  });

  it("shows the take for the clip's current version", async () => {
    const project = projectWith([clip]);
    stubDisk({ c: [hashOf(project, clip)] });
    pool.sync(project);
    await settle();
    expect(label(pool, "c")).toBe(`take:${hashOf(project, clip)}`);
  });

  it("keeps showing the take it has when an edit makes a version with no take yet", async () => {
    const project = projectWith([clip]);
    const recorded = hashOf(project, clip);
    stubDisk({ c: [recorded] });
    pool.sync(project);
    await settle();
    const longer = { ...clip, duration: 6 };
    pool.sync(projectWith([longer]));
    expect(label(pool, "c")).toBe(`take:${recorded}`);
    await settle();
    expect(label(pool, "c")).toBe(`take:${recorded}`);
  });

  it("falls back to the clip's newest take, and to the placeholder only when it was never recorded", async () => {
    stubDisk({ c: ["1111111111111111", "2222222222222222"] });
    pool.sync(projectWith([clip, { ...clip, id: "never" }]));
    await settle();
    expect(label(pool, "c")).toBe("take:1111111111111111");
    expect(label(pool, "never")).toBe("placeholder");
  });

  it("swaps the stand-in for the current take once it is recorded", async () => {
    pool.dispose();
    vi.useFakeTimers();
    pool = createFrameSourcePool({
      maxAnisotropy: 1,
      placeholderLabel: "Not recorded yet",
      onFrame: () => {},
    });
    try {
      const project = projectWith([clip]);
      const disk = { c: ["1111111111111111"] };
      stubDisk(disk);
      pool.sync(project);
      await vi.advanceTimersByTimeAsync(0);
      disk.c.unshift(hashOf(project, clip));
      await vi.advanceTimersByTimeAsync(3000);
      expect(label(pool, "c")).toBe(`take:${hashOf(project, clip)}`);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refreshes without touching a take that didn't change, and swaps one recorded over", async () => {
    const project = projectWith([clip]);
    const hash = hashOf(project, clip);
    const fetchMock = stubDisk({ c: [hash] });
    pool.sync(project);
    await settle();
    const before = pool.get("c");
    pool.refresh(project);
    await settle();
    expect(pool.get("c")).toBe(before);
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ captureHash: hash, video: { file: "proxy.mp4" }, frameCount: 2 }))
    );
    pool.refresh(project);
    expect(pool.get("c")).toBe(before);
    await settle();
    expect(pool.get("c")).not.toBe(before);
    expect(label(pool, "c")).toBe(`take:${hash}`);
  });

  it("never looks for takes of imported footage", async () => {
    const fetchMock = stubDisk({});
    const imported: Clip = {
      ...clip,
      source: { kind: "import", file: "imports/a.mp4", trimStart: 0, fileDuration: 9, width: 2, height: 2 },
    };
    pool.sync(projectWith([imported]));
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
