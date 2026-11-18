import { describe, expect, it } from "vitest";
import type { RecordingManifest } from "../recording/recording-manifest";
import { createProject, createRecordingClip, createTextClip } from "../storyboard/storyboard-factories";
import type { Clip, Project } from "../storyboard/storyboard-schema";
import type { ScannedTake } from "./project-assets";
import { pickProjectStill } from "./project-still";

const manifest = (frameCount: number, proxy: RecordingManifest["proxy"] = { dpr: 1 }): RecordingManifest => ({
  version: 1,
  clipId: "rec",
  captureHash: "0000000000000000",
  theme: "dark",
  fps: 30,
  frameCount,
  viewport: { width: 1440, height: 900 },
  dpr: 2,
  cursor: [],
  focus: [],
  proxy,
});

const take = (
  hash: string,
  frames: number,
  modifiedAt: number,
  proxy?: RecordingManifest["proxy"]
): ScannedTake => ({
  clipId: "rec",
  hash,
  manifest: manifest(frames, proxy),
  modifiedAt,
});

function projectWith(...clips: Clip[]): Project {
  const project = createProject({ name: "Still", now: new Date("2026-11-18T00:00:00Z") });
  return { ...project, videoTracks: [{ ...project.videoTracks[0]!, clips }] };
}

const intro = createTextClip({ text: "Hi", duration: 3 });
const recording = { ...createRecordingClip({ name: "Ask", route: "/home", start: 3 }), id: "rec" };

describe("pickProjectStill", () => {
  it("skips text for the middle frame of the newest take when none matches the script", () => {
    const takes = [take("aaaaaaaaaaaaaaaa", 100, 1), take("bbbbbbbbbbbbbbbb", 60, 2)];
    expect(pickProjectStill(projectWith(intro, recording), { takes, imports: [] })).toEqual({
      kind: "image",
      file: "recordings/rec/bbbbbbbbbbbbbbbb/proxy/000030.webp",
    });
  });

  it("uses full frames when the take has no proxy, and nothing for a project of text", () => {
    const takes = [take("aaaaaaaaaaaaaaaa", 10, 1, null)];
    expect(pickProjectStill(projectWith(recording), { takes, imports: [] })).toEqual({
      kind: "image",
      file: "recordings/rec/aaaaaaaaaaaaaaaa/frames/000005.png",
    });
    expect(pickProjectStill(projectWith(intro), { takes, imports: [] })).toBeNull();
  });

  it("shows an imported video at the middle of the part the clip plays", () => {
    const imported: Clip = {
      ...intro,
      id: "imp",
      start: 0,
      duration: 4,
      source: {
        kind: "import",
        file: "imports/a.mp4",
        trimStart: 2,
        fileDuration: 10,
        width: 1920,
        height: 1080,
      },
    };
    expect(pickProjectStill(projectWith(recording, imported), { takes: [], imports: [] })).toEqual({
      kind: "video",
      file: "imports/a.mp4",
      time: 4,
    });
  });
});
