import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { captureHashForClip } from "../recording/capture-hash";
import type { RecordingManifest } from "../recording/recording-manifest";
import { createProject, createRecordingClip, createTextClip } from "../storyboard/storyboard-factories";
import type { Clip, Project } from "../storyboard/storyboard-schema";
import { activeTakeHash, listProjectAssets, pinnedTakeFor, type ScannedTake } from "./project-assets";
import { scanProjectAssets } from "./scan-project-assets";

const NOW = new Date("2026-11-17T10:00:00Z");

function manifest(overrides: Partial<RecordingManifest> = {}): RecordingManifest {
  return {
    version: 1,
    clipId: "rec",
    captureHash: "0000000000000000",
    theme: "light",
    fps: 30,
    frameCount: 120,
    viewport: { width: 1440, height: 900 },
    dpr: 2,
    cursor: [],
    focus: [],
    proxy: { dpr: 1 },
    ...overrides,
  };
}

function projectWith(clips: Clip[]): Project {
  const project = createProject({ name: "Assets", now: NOW });
  return { ...project, videoTracks: [{ ...project.videoTracks[0], clips }] };
}

const recording = { ...createRecordingClip({ name: "Ask the agent", route: "/home" }), id: "rec" };
const imported: Clip = {
  ...createTextClip({ text: "x" }),
  id: "vid",
  name: "Footage",
  source: {
    kind: "import",
    file: "imports/448247cf-e77c-441f-8df4-ee65a0a796ba-footage.mp4",
    trimStart: 0,
    fileDuration: 9,
    width: 1920,
    height: 1080,
  },
};
const title = { ...createTextClip({ text: "Meet the agent" }), id: "title" };

describe("activeTakeHash", () => {
  it("is the pinned take, else the hash of the clip as it is now", () => {
    const project = projectWith([recording]);
    expect(activeTakeHash(project, recording)).toBe(captureHashForClip({ project, clip: recording }));
    const pinned: Clip = {
      ...recording,
      source: { kind: "recording", route: "/home", actions: [], take: "abcdefabcdefabcd" },
    };
    expect(activeTakeHash(project, pinned)).toBe("abcdefabcdefabcd");
    expect(activeTakeHash(project, title)).toBeNull();
  });
});

describe("pinnedTakeFor", () => {
  it("pins an earlier take, and clears the pin for the take the script produces", () => {
    const project = projectWith([recording]);
    const scripted = captureHashForClip({ project, clip: recording });
    const pinned: Clip = {
      ...recording,
      source: { kind: "recording", route: "/home", actions: [], take: "abcdefabcdefabcd" },
    };
    expect(pinnedTakeFor(project, recording, "1111111111111111")).toBe("1111111111111111");
    expect(pinnedTakeFor(project, pinned, scripted)).toBeUndefined();
  });
});

describe("listProjectAssets", () => {
  const project = projectWith([recording, imported, title]);
  const current = captureHashForClip({ project, clip: recording });
  const takes: ScannedTake[] = [
    { clipId: "rec", hash: "1111111111111111", manifest: manifest({ proxy: null }), modifiedAt: 1 },
    { clipId: "rec", hash: current, manifest: manifest(), modifiedAt: 2 },
    { clipId: "gone", hash: "2222222222222222", manifest: null, modifiedAt: 3 },
  ];
  const assets = listProjectAssets(project, {
    takes,
    imports: [
      { file: "imports/448247cf-e77c-441f-8df4-ee65a0a796ba-footage.mp4", bytes: 10, modifiedAt: 1 },
      { file: "imports/song.mp3", bytes: 5, modifiedAt: 2 },
      { file: "imports/song.mp3.peaks.json", bytes: 1, modifiedAt: 2 },
    ],
  });

  it("groups takes by clip, newest first, marking the one the clip shows", () => {
    expect(assets.recordings.map((group) => [group.clipId, group.name])).toEqual([
      ["rec", "Ask the agent"],
      ["gone", null],
    ]);
    expect(assets.recordings[0].takes.map((take) => [take.hash, take.active, take.thumbnail])).toEqual([
      [current, true, `recordings/rec/${current}/proxy/000000.webp`],
      ["1111111111111111", false, "recordings/rec/1111111111111111/frames/000000.png"],
    ]);
    expect(assets.recordings[1].takes[0].thumbnail).toBeNull();
  });

  it("lists media files with a template from a clip that uses them, skipping sidecars", () => {
    expect(assets.files.map((file) => [file.name, file.kind, file.template?.clip.id ?? null])).toEqual([
      ["song.mp3", "audio", null],
      ["footage.mp4", "video", "vid"],
    ]);
  });

  it("previews a take with its MP4 proxy, else its WebP proxy frames, else nothing", () => {
    const withVideo = listProjectAssets(project, {
      takes: [
        {
          clipId: "rec",
          hash: current,
          manifest: manifest({ video: { file: "proxy.mp4", width: 1440, height: 900 } }),
          modifiedAt: 4,
        },
      ],
      imports: [],
    });
    expect(withVideo.recordings[0].takes[0].preview).toEqual({
      kind: "video",
      file: `recordings/rec/${current}/proxy.mp4`,
    });
    expect(assets.recordings[0].takes.map((take) => take.preview)).toEqual([
      { kind: "frames", folder: `recordings/rec/${current}/proxy` },
      null,
    ]);
    expect(assets.recordings[1].takes[0].preview).toBeNull();
  });

  it("lists text clips", () => {
    expect(assets.texts).toEqual([
      { clipId: "title", name: title.name, text: "Meet the agent", template: { kind: "video", clip: title } },
    ]);
  });
});

describe("scanProjectAssets", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "product-video-assets-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads takes with their manifests and the imports folder", async () => {
    const take = path.join(dir, "recordings", "rec", "1111111111111111");
    await mkdir(take, { recursive: true });
    await writeFile(path.join(take, "manifest.json"), JSON.stringify(manifest()));
    await mkdir(path.join(dir, "recordings", "rec", "2222222222222222"));
    await mkdir(path.join(dir, "imports"));
    await writeFile(path.join(dir, "imports", "clip.mp4"), "abc");

    const scan = await scanProjectAssets(dir);
    expect(scan.takes.map((t) => [t.hash, t.manifest?.frameCount ?? null]).sort()).toEqual([
      ["1111111111111111", 120],
      ["2222222222222222", null],
    ]);
    expect(scan.imports.map((entry) => [entry.file, entry.bytes])).toEqual([["imports/clip.mp4", 3]]);
  });

  it("answers an empty scan for a project with no folders yet", async () => {
    expect(await scanProjectAssets(path.join(dir, "missing"))).toEqual({ takes: [], imports: [] });
  });
});
