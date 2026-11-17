import { describe, expect, it } from "vitest";
import { createProject, createRecordingClip, createTextClip } from "./storyboard-factories";
import { clipSchema, MAX_RECORDING_SECONDS, projectSchema, videoTrackSchema } from "./storyboard-schema";

const recording = () => createRecordingClip({ name: "Ask the agent", route: "/home" });
const track = (clips: ReturnType<typeof createTextClip>[]) => ({ id: "v1", name: "Video 1", clips });
const text = (start: number, duration = 3) => createTextClip({ text: "Title", start, duration });

describe("clipSchema", () => {
  it("accepts a recording at the cap and rejects one over it", () => {
    expect(clipSchema.safeParse({ ...recording(), duration: MAX_RECORDING_SECONDS }).success).toBe(true);
    const result = clipSchema.safeParse({ ...recording(), duration: MAX_RECORDING_SECONDS + 0.1 });
    expect(result.error?.issues[0]?.path).toEqual(["duration"]);
  });

  it("allows long text clips", () => {
    expect(clipSchema.safeParse(text(0, 20)).success).toBe(true);
  });

  it("rejects a keyframe after the clip ends", () => {
    const clip = {
      ...text(0),
      properties: { zoom: { value: 1, keyframes: [{ id: "k", at: 4, value: 1, ease: "linear" }] } },
    };
    expect(clipSchema.safeParse(clip).error?.issues[0]?.path).toEqual([
      "properties",
      "zoom",
      "keyframes",
      0,
      "at",
    ]);
  });

  it("rejects a property value outside its range", () => {
    expect(
      clipSchema.safeParse({ ...text(0), properties: { zoom: { value: 20, keyframes: [] } } }).success
    ).toBe(false);
  });

  it("rejects a route that is not a path", () => {
    const clip = {
      ...recording(),
      source: { kind: "recording", route: "https://cal.com/home", actions: [] },
    };
    expect(clipSchema.safeParse(clip).success).toBe(false);
  });

  it("rejects an import that runs past its file", () => {
    const clip = {
      ...text(0, 5),
      source: {
        kind: "import",
        file: "imports/a.mp4",
        trimStart: 2,
        fileDuration: 6,
        width: 1920,
        height: 1080,
      },
    };
    expect(clipSchema.safeParse(clip).success).toBe(false);
  });
});

describe("videoTrackSchema", () => {
  it("accepts a short overlap and a gap", () => {
    expect(videoTrackSchema.safeParse(track([text(0), text(2.4), text(6)])).success).toBe(true);
  });

  it("rejects an overlap over two seconds", () => {
    expect(videoTrackSchema.safeParse(track([text(0, 5), text(2.5)])).success).toBe(false);
  });

  it("rejects a clip covering another", () => {
    expect(videoTrackSchema.safeParse(track([text(0, 1), text(0, 3)])).success).toBe(false);
  });

  it("rejects a clip overlapping two clips", () => {
    expect(videoTrackSchema.safeParse(track([text(0, 3), text(2, 1.5), text(2.9, 3)])).success).toBe(false);
  });
});

describe("projectSchema", () => {
  it("rejects v1 projects", () => {
    expect(
      projectSchema.safeParse({ ...createProject({ name: "Launch", now: new Date() }), version: 1 }).success
    ).toBe(false);
  });

  it("rejects an unknown aspect ratio", () => {
    const project = createProject({ name: "Launch", now: new Date() });
    const result = projectSchema.safeParse({
      ...project,
      settings: { ...project.settings, aspectRatio: "3:2" },
    });
    expect(result.success).toBe(false);
  });

  it("needs at least one video track", () => {
    expect(
      projectSchema.safeParse({ ...createProject({ name: "Launch", now: new Date() }), videoTracks: [] })
        .success
    ).toBe(false);
  });
});
