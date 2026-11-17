import { describe, expect, it } from "vitest";
import { applyGeneratedClips } from "./board-generation";
import type { Board, BoardNode } from "./board-schema";
import { createProject, createTextClip } from "./storyboard-factories";
import { type Clip, type Project, projectSchema } from "./storyboard-schema";

const node = (id: string, y: number): BoardNode => ({
  id,
  kind: "text",
  title: id,
  notes: "",
  duration: 2,
  position: { x: 0, y },
  words: id,
});

const board: Board = {
  brief: "",
  nodes: [node("hook", 0), node("scene", 100), node("end", 200)],
  edges: [
    { id: "e1", from: "hook", to: "scene", transition: "crossfade", transitionSeconds: 0.5 },
    { id: "e2", from: "scene", to: "end", transition: "cut", transitionSeconds: 0 },
  ],
};

const clip = (id: string, duration = 2, nodeId?: string, start = 0): Clip => ({
  ...createTextClip({ text: id, duration, start }),
  id,
  storyboardNodeId: nodeId,
});

const project = (clips: Clip[] = []): Project => {
  const base = createProject({ name: "Demo", now: new Date("2026-11-18T08:00:00Z") });
  return { ...base, storyboard: board, videoTracks: [{ ...base.videoTracks[0], clips }] };
};

const spans = (result: Project) =>
  result.videoTracks[0].clips.map((c) => ({ id: c.id, start: c.start, transitionIn: c.transitionIn }));

describe("applyGeneratedClips", () => {
  it("puts the first node at the start of track 0", () => {
    const result = applyGeneratedClips(project(), "hook", [clip("h")]);
    expect(spans(result)).toEqual([{ id: "h", start: 0, transitionIn: "crossfade" }]);
    expect(result.videoTracks[0].clips[0].storyboardNodeId).toBe("hook");
  });

  it("overlaps the previous node's clip by the edge's transition", () => {
    const result = applyGeneratedClips(project([clip("h", 2, "hook")]), "scene", [clip("s")]);
    expect(spans(result)).toEqual([
      { id: "h", start: 0, transitionIn: "crossfade" },
      { id: "s", start: 1.5, transitionIn: "crossfade" },
    ]);
    expect(projectSchema.safeParse(result).success).toBe(true);
  });

  it("butts clips together on a cut", () => {
    const start = project([clip("h", 2, "hook"), clip("s", 2, "scene", 1.5)]);
    const result = applyGeneratedClips(start, "end", [clip("e")]);
    expect(spans(result).at(-1)).toEqual({ id: "e", start: 3.5, transitionIn: "crossfade" });
  });

  it("replaces a node's clips in place and moves later clips right", () => {
    const start = project([clip("h", 2, "hook"), clip("s", 2, "scene", 1.5), clip("e", 2, "end", 3.5)]);
    const result = applyGeneratedClips(start, "scene", [clip("s2", 4)]);
    expect(spans(result)).toEqual([
      { id: "h", start: 0, transitionIn: "crossfade" },
      { id: "s2", start: 1.5, transitionIn: "crossfade" },
      { id: "e", start: 5.5, transitionIn: "crossfade" },
    ]);
    expect(projectSchema.safeParse(result).success).toBe(true);
  });

  it("inserts before later nodes when the node is new", () => {
    const start = project([clip("h", 2, "hook"), clip("e", 2, "end", 2)]);
    const result = applyGeneratedClips(start, "scene", [clip("s", 3)]);
    expect(spans(result).map(({ id, start }) => [id, start])).toEqual([
      ["h", 0],
      ["s", 1.5],
      ["e", 4.5],
    ]);
    expect(projectSchema.safeParse(result).success).toBe(true);
  });

  it("shortens the overlap so it never covers a short clip", () => {
    const result = applyGeneratedClips(project([clip("h", 0.4, "hook")]), "scene", [clip("s")]);
    const placed = result.videoTracks[0].clips.find((c) => c.id === "s");
    expect(placed?.start).toBeCloseTo(0.1);
    expect(projectSchema.safeParse(result).success).toBe(true);
  });
});

describe("applyGeneratedClips track choice", () => {
  const twoTracks = (first: Partial<Project["videoTracks"][number]>, second: Clip[] = []): Project => {
    const base = project();
    return {
      ...base,
      videoTracks: [
        { ...base.videoTracks[0], ...first },
        { id: "t2", name: "Video 2", clips: second },
      ],
    };
  };

  it("skips hidden tracks", () => {
    const result = applyGeneratedClips(twoTracks({ hidden: true }), "hook", [clip("h")]);
    expect(result.videoTracks[0].clips).toEqual([]);
    expect(result.videoTracks[1].clips.map((c) => c.id)).toEqual(["h"]);
  });

  it("moves a node's clip off a hidden track", () => {
    const result = applyGeneratedClips(twoTracks({ hidden: true, clips: [clip("old", 2, "hook")] }), "hook", [
      clip("h"),
    ]);
    expect(result.videoTracks[0].clips).toEqual([]);
    expect(result.videoTracks[1].clips.map((c) => c.id)).toEqual(["h"]);
  });

  it("keeps a board's clips on the track it already uses", () => {
    const result = applyGeneratedClips(twoTracks({}, [clip("h", 2, "hook")]), "scene", [clip("s")]);
    expect(result.videoTracks[0].clips).toEqual([]);
    expect(result.videoTracks[1].clips.map((c) => [c.id, c.start])).toEqual([
      ["h", 0],
      ["s", 1.5],
    ]);
    expect(projectSchema.safeParse(result).success).toBe(true);
  });

  it("adds a track when the visible ones are busy at the start", () => {
    const busy = twoTracks({ clips: [clip("other", 4)] }, [clip("other-2", 4, undefined, 1)]);
    const result = applyGeneratedClips(busy, "hook", [clip("h")]);
    expect(result.videoTracks).toHaveLength(3);
    expect(result.videoTracks[2]).toMatchObject({ name: "Video 3", clips: [{ id: "h", start: 0 }] });
    expect(projectSchema.safeParse(result).success).toBe(true);
  });
});
