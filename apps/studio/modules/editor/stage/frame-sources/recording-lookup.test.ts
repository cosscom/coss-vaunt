import { createProject, createRecordingClip } from "@calcom/product-video/storyboard/storyboard-factories";
import type { Clip, Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadRecording, recordingDirectoryUrl, recordingHashFor } from "./recording-lookup";

const project = createProject({ name: "Demo", now: new Date(Date.UTC(2026, 10, 17)) });
const withTheme = (theme: Project["settings"]["theme"]) => ({ settings: { ...project.settings, theme } });
const clip = createRecordingClip({ name: "Home", route: "/home" });

describe("recordingHashFor", () => {
  it("changes with the theme, so a dark recording never shows in the light editor", () => {
    expect(recordingHashFor(withTheme("light"), clip)).not.toBe(recordingHashFor(withTheme("dark"), clip));
  });

  it("ignores camera moves and follows capture edits", () => {
    const base = recordingHashFor(project, clip);
    const turned: Clip = { ...clip, properties: { rotateY: { value: 20, keyframes: [] } } };
    expect(recordingHashFor(project, turned)).toBe(base);
    expect(recordingHashFor(project, { ...clip, duration: clip.duration - 1 })).not.toBe(base);
  });

  it("is null for clips that aren't recordable", () => {
    expect(
      recordingHashFor(project, { ...clip, source: { kind: "recording", route: "/nope", actions: [] } })
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
    const recording = await loadRecording("/api/projects/p/files", "clip 1", "abc");
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/p/files/recordings/clip%201/abc/manifest.json", {
      cache: "no-store",
    });
    expect(recording).toEqual({
      directoryUrl: recordingDirectoryUrl("/api/projects/p/files", "clip 1", "abc"),
      manifest: { captureHash: "abc" },
    });
  });

  it("is null when that recording doesn't exist yet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Not found", { status: 404 })));
    expect(await loadRecording("/files", "c", "abc")).toBeNull();
  });
});
