import { createProject, createRecordingClip } from "@calcom/product-video/storyboard/storyboard-factories";
import type { Clip, Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadLatestRecording,
  loadRecording,
  recordingDirectoryUrl,
  recordingTakesFor,
  wantedTakes,
} from "./recording-lookup";

const project = createProject({ name: "Demo", now: new Date(Date.UTC(2026, 10, 17)) });
const withTheme = (theme: Project["settings"]["theme"]) => ({ settings: { ...project.settings, theme } });
const clip = createRecordingClip({ name: "Home", route: "/home" });

const recordingHashFor = (settings: Pick<Project, "settings">, candidate: Clip) =>
  recordingTakesFor(settings, candidate)?.hashes[0] ?? null;

describe("recordingTakesFor", () => {
  it("changes with the theme, so a dark recording never shows in the light editor", () => {
    expect(recordingHashFor(withTheme("light"), clip)).not.toBe(recordingHashFor(withTheme("dark"), clip));
  });

  it("ignores camera moves and follows capture edits", () => {
    const base = recordingHashFor(project, clip);
    const turned: Clip = { ...clip, properties: { rotateY: { value: 20, keyframes: [] } } };
    expect(recordingHashFor(project, turned)).toBe(base);
    expect(recordingHashFor(project, { ...clip, duration: clip.duration - 1 })).not.toBe(base);
  });

  it("keeps its key when zooming in raises the DPR, and falls back to takes at other DPRs", () => {
    const zoomed: Clip = { ...clip, properties: { zoom: { value: 3, keyframes: [] } } };
    const [plain, close] = [recordingTakesFor(project, clip), recordingTakesFor(project, zoomed)];
    expect(close?.key).toBe(plain?.key);
    expect(close?.hashes[0]).not.toBe(plain?.hashes[0]);
    expect(close?.hashes).toContain(plain?.hashes[0]);
  });

  it("is the pinned take when the author chose one", () => {
    const pinned: Clip = {
      ...clip,
      source: { kind: "recording", route: "/home", actions: [], take: "0123456789abcdef" },
    };
    expect(recordingHashFor(project, pinned)).toBe("0123456789abcdef");
  });

  it("is null for clips that aren't recordable", () => {
    expect(
      recordingHashFor(project, {
        ...clip,
        source: { kind: "recording", route: "//elsewhere.example", actions: [] },
      })
    ).toBeNull();
    expect(
      recordingHashFor(project, {
        ...clip,
        source: { kind: "image", file: "imports/a.png", width: 1, height: 1 },
      })
    ).toBeNull();
  });
});

describe("loadRecording", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the manifest for exactly that hash", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ captureHash: "abc" })));
    vi.stubGlobal("fetch", fetchMock);
    const recording = await loadRecording("/api/projects/p/files", "clip 1", ["abc"]);
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/p/files/recordings/clip%201/abc/manifest.json", {
      cache: "no-store",
    });
    expect(recording).toEqual({
      directoryUrl: recordingDirectoryUrl("/api/projects/p/files", "clip 1", "abc"),
      manifest: { captureHash: "abc" },
      hash: "abc",
    });
  });

  it("takes the first of several hashes that has a recording", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/def/") ? new Response(JSON.stringify({})) : new Response("Not found", { status: 404 })
      )
    );
    expect((await loadRecording("/files", "c", ["abc", "def"]))?.hash).toBe("def");
  });

  it("is null when that recording doesn't exist yet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Not found", { status: 404 })));
    expect(await loadRecording("/files", "c", ["abc"])).toBeNull();
  });
});

describe("loadLatestRecording", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const newer = "1111111111111111";
  const older = "2222222222222222";
  const listing = [
    { name: `${newer}.partial-42`, directory: true },
    { name: newer, directory: true },
    { name: older, directory: true },
  ];

  it("shows the newest take that finished, skipping recordings still being written", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/recordings/c")) return new Response(JSON.stringify({ entries: listing }));
      return url.includes(`/${newer}/`)
        ? new Response(JSON.stringify({ captureHash: newer }))
        : new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect((await loadLatestRecording("/files", "c"))?.hash).toBe(newer);
    expect(fetchMock.mock.calls.some(([url]) => url.includes("partial"))).toBe(false);
  });

  it("moves on to an older take when the newest has no manifest", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/recordings/c")) return new Response(JSON.stringify({ entries: listing }));
        return url.includes(`/${older}/`)
          ? new Response(JSON.stringify({}))
          : new Response("Not found", { status: 404 });
      })
    );
    expect((await loadLatestRecording("/files", "c"))?.hash).toBe(older);
  });

  it("is null for a clip that was never recorded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Not found", { status: 404 })));
    expect(await loadLatestRecording("/files", "c")).toBeNull();
  });
});

describe("wantedTakes", () => {
  it("asks for every candidate while the clip shows none of them", () => {
    expect(wantedTakes(["best", "sharper"], null)).toEqual(["best", "sharper"]);
    expect(wantedTakes(["best", "sharper"], "older-version")).toEqual(["best", "sharper"]);
  });

  it("asks only for the best take while a stand-in shows, and for nothing once it has it", () => {
    expect(wantedTakes(["best", "sharper"], "sharper")).toEqual(["best"]);
    expect(wantedTakes(["best", "sharper"], "best")).toEqual([]);
  });
});
