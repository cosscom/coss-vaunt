import { describe, expect, it } from "vitest";
import { createProject, createRecordingClip, createTextClip } from "./storyboard-factories";
import { clipSchema, projectSchema } from "./storyboard-schema";

describe("createProject", () => {
  const project = createProject({ name: "  Launch  ", now: new Date("2026-11-17T10:00:00Z") });

  it("creates a valid v2 project with one empty video track and one empty audio track", () => {
    expect(projectSchema.parse(project).version).toBe(2);
    expect(project.name).toBe("Launch");
    expect(project.videoTracks.map((track) => [track.name, track.clips.length])).toEqual([["Video 1", 0]]);
    expect(project.audioTracks.map((track) => [track.name, track.clips.length])).toEqual([["Audio", 0]]);
  });

  it("starts with the default device", () => {
    expect(project.settings.device).toEqual({
      cornerRadius: 16,
      contactShadow: false,
      plinth: false,
      reflection: 0,
    });
  });
});

describe("clip factories", () => {
  it("creates valid recording and text clips", () => {
    expect(clipSchema.safeParse(createRecordingClip({ name: "Ask", route: "/home", start: 2 })).success).toBe(
      true
    );
    const text = createTextClip({ text: "Your title" });
    expect(clipSchema.parse(text).duration).toBe(3);
    expect(text.name).toBe("Your title");
  });
});
