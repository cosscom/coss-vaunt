import { describe, expect, it } from "vitest";
import type { Clip } from "./storyboard-schema";
import { activeClipsAt, projectDuration } from "./track-resolution";

const textClip = (id: string, start: number, duration: number): Clip => ({
  id,
  name: id,
  start,
  duration,
  transitionIn: "crossfade",
  properties: {},
  source: { kind: "text", text: id, size: "title", align: "center", weight: 600 },
});

const project = {
  videoTracks: [
    { id: "t1", name: "Video 1", clips: [textClip("a", 0, 4), textClip("b", 3.4, 4)] },
    { id: "t2", name: "Video 2", clips: [textClip("title", 1, 2)] },
  ],
  audioTracks: [],
};

describe("activeClipsAt", () => {
  it("skips hidden tracks but keeps track indices", () => {
    const hidden = {
      ...project,
      videoTracks: [{ ...project.videoTracks[0], hidden: true }, project.videoTracks[1]],
    };
    expect(activeClipsAt(hidden, 1.5).map((entry) => [entry.clip.id, entry.trackIndex])).toEqual([
      ["title", 1],
    ]);
  });

  it("plays an overlap as the incoming clip's transition", () => {
    const active = activeClipsAt(project, 3.7);
    const outgoing = active.find((entry) => entry.clip.id === "a");
    const incoming = active.find((entry) => entry.clip.id === "b");
    expect(outgoing?.transition).toEqual({
      kind: "crossfade",
      progress: expect.closeTo(0.5),
      role: "outgoing",
    });
    expect(incoming?.presence).toBeCloseTo(0.5);
    expect(incoming?.localTime).toBeCloseTo(0.3);
  });

  it("draws higher tracks over lower ones", () => {
    expect(activeClipsAt(project, 1.5).map((entry) => entry.clip.id)).toEqual(["a", "title"]);
  });

  it("shows nothing in a gap", () => {
    expect(
      activeClipsAt(
        { videoTracks: [{ id: "t", name: "t", clips: [textClip("a", 0, 1), textClip("b", 2, 1)] }] },
        1.5
      )
    ).toEqual([]);
  });
});

describe("projectDuration", () => {
  it("ends at the last clip on any track, overlaps included", () => {
    expect(projectDuration(project)).toBeCloseTo(7.4);
  });
});
