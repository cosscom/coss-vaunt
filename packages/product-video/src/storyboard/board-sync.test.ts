import { describe, expect, it } from "vitest";
import { applyGeneratedClips } from "./board-generation";
import { boardOrder } from "./board-order";
import type { Board, BoardEdge, BoardNode } from "./board-schema";
import { reconcileBoard, removeScenes, reorderScene, syncBoard } from "./board-sync";
import {
  duplicateClips,
  moveClip,
  removeClips,
  setClipDuration,
  splitClip,
  trimClip,
} from "./storyboard-edits";
import { createProject, createRecordingClip, createTextClip } from "./storyboard-factories";
import { type Clip, type Project, projectSchema } from "./storyboard-schema";

const textNode = (id: string, y: number, extra: Partial<BoardNode> = {}): BoardNode =>
  ({
    id,
    kind: "text",
    title: id,
    notes: "",
    duration: 2,
    position: { x: 0, y },
    words: id,
    ...extra,
  }) as BoardNode;

const edge = (
  from: string,
  to: string,
  transition: BoardEdge["transition"] = "cut",
  seconds = 0
): BoardEdge => ({
  id: `${from}-${to}`,
  from,
  to,
  transition,
  transitionSeconds: seconds,
});

const textClip = (id: string, start: number, duration = 2, nodeId?: string): Clip => ({
  ...createTextClip({ text: id, start, duration }),
  id,
  storyboardNodeId: nodeId,
});

const imageClip = (id: string, start: number, duration = 3): Clip => ({
  id,
  name: `${id}.png`,
  start,
  duration,
  transitionIn: "crossfade",
  properties: {},
  source: { kind: "image", file: `imports/${id}.png`, width: 100, height: 100 },
});

function project(clips: Clip[], board?: Board, topClips: Clip[] = []): Project {
  const base = createProject({ name: "Demo", now: new Date("2026-11-26T08:00:00Z") });
  const [track] = base.videoTracks;
  return {
    ...base,
    storyboard: board,
    videoTracks: [
      { ...track, clips },
      ...(topClips.length > 0 ? [{ ...track, id: "top", name: "Top", clips: topClips }] : []),
    ],
  };
}

/** The scenes in story order, with what the board says about each. */
const story = (result: Project) =>
  boardOrder(result.storyboard as Board).map((node) => `${node.id}:${node.duration}`);

/** Applies one edit the way the editor does: the edit, then the sync, from the last synced project. */
const editAfter = (before: Project, update: (current: Project) => Project, keep?: ReadonlySet<string>) =>
  syncBoard(before, update(before), { keep });

const synced = (start: Project) => reconcileBoard(start, start);

describe("reconcileBoard", () => {
  it("leaves a project with no clips and no board alone", () => {
    const start = project([]);
    expect(reconcileBoard(start, start)).toBe(start);
  });

  it("makes a scene for every clip, in timeline order, and binds the clips to them", () => {
    const result = synced(project([textClip("b", 2), textClip("a", 0), imageClip("c", 4)]));
    expect(story(result)).toEqual(["a:2", "b:2", "c:3"]);
    const nodes = new Map(result.storyboard?.nodes.map((node) => [node.id, node]));
    expect(nodes.get("a")).toMatchObject({ kind: "text", words: "a", title: "a" });
    expect(nodes.get("c")).toMatchObject({ kind: "media", file: "imports/c.png", title: "c.png" });
    expect(result.videoTracks[0].clips.map((clip) => clip.storyboardNodeId)).toEqual(["b", "a", "c"]);
    expect(projectSchema.safeParse(result).success).toBe(true);
  });

  it("makes recording scenes from recording clips", () => {
    const clip = { ...createRecordingClip({ name: "Sign up", route: "/signup", duration: 5 }), id: "r" };
    const node = synced(project([clip])).storyboard?.nodes[0];
    expect(node).toMatchObject({ kind: "recording", route: "/signup", startFrom: "fresh", duration: 5 });
  });

  it("returns the same project when the board already matches", () => {
    const once = synced(project([textClip("a", 0), textClip("b", 2)]));
    expect(reconcileBoard(once, once)).toBe(once);
  });

  it("adds a dropped clip as a scene where it lands, keeping the other scenes' direction", () => {
    const board: Board = {
      brief: "Launch",
      nodes: [textNode("intro", 0, { notes: "Say hi" }), textNode("outro", 112)],
      edges: [edge("intro", "outro", "crossfade", 0.5)],
    };
    const before = synced(project([textClip("i", 0, 2, "intro"), textClip("o", 4, 2, "outro")], board));
    const after = editAfter(before, (current) => ({
      ...current,
      videoTracks: [
        { ...current.videoTracks[0], clips: [...current.videoTracks[0].clips, imageClip("m", 2, 2)] },
      ],
    }));
    expect(story(after)).toEqual(["intro:2", "m:2", "outro:2"]);
    expect(after.storyboard?.brief).toBe("Launch");
    expect(after.storyboard?.nodes.find((node) => node.id === "intro")?.notes).toBe("Say hi");
    expect(after.storyboard?.nodes.map((node) => node.position.y).sort((a, b) => a - b)).toEqual([
      0, 112, 224,
    ]);
  });

  it("follows a trim with the scene's duration", () => {
    const before = synced(project([textClip("a", 0, 2), textClip("b", 3, 2)]));
    const after = editAfter(before, (current) => trimClip(current, "a", "end", 1.5));
    expect(story(after)).toEqual(["a:1.5", "b:2"]);
  });

  it("reorders scenes when clips are moved past each other", () => {
    const before = synced(project([textClip("a", 0), textClip("b", 2)]));
    const after = editAfter(before, (current) => moveClip(current, "a", { start: 5, trackIndex: 0 }));
    expect(story(after)).toEqual(["b:2", "a:2"]);
    expect(after.storyboard?.edges).toHaveLength(1);
    expect(after.storyboard?.edges[0]).toMatchObject({ from: "b", to: "a" });
  });

  it("removes the scene of a deleted clip and joins its neighbours", () => {
    const before = synced(project([textClip("a", 0), textClip("b", 2), textClip("c", 4)]));
    const after = editAfter(before, (current) => removeClips(current, ["b"]));
    expect(story(after)).toEqual(["a:2", "c:2"]);
    expect(after.storyboard?.edges.map((e) => [e.from, e.to])).toEqual([["a", "c"]]);
  });

  it("keeps a scene being generated when its clip goes", () => {
    const before = synced(project([textClip("a", 0), textClip("b", 2)]));
    const after = editAfter(before, (current) => removeClips(current, ["b"]), new Set(["b"]));
    expect(story(after)).toEqual(["a:2", "b:2"]);
  });

  it("keeps drafts after the scene before them", () => {
    const board: Board = {
      brief: "",
      nodes: [textNode("a", 0), textNode("draft", 112), textNode("b", 224)],
      edges: [edge("a", "draft"), edge("draft", "b")],
    };
    const before = synced(project([textClip("ca", 0, 2, "a"), textClip("cb", 2, 2, "b")], board));
    expect(story(before)).toEqual(["a:2", "draft:2", "b:2"]);
    const after = editAfter(before, (current) => moveClip(current, "ca", { start: 6, trackIndex: 0 }));
    expect(story(after)).toEqual(["b:2", "a:2", "draft:2"]);
  });

  it("leaves drafts that aren't joined to a scene where they are", () => {
    const loose = textNode("loose", 500, { position: { x: 400, y: 500 } });
    const board: Board = { brief: "", nodes: [textNode("a", 0), loose], edges: [] };
    const before = synced(project([textClip("ca", 0, 2, "a")], board));
    const after = editAfter(before, (current) => removeClips(current, ["ca"]));
    expect(after.storyboard?.nodes).toEqual([loose]);
    expect(after.storyboard?.edges).toEqual([]);
  });

  it("gives a duplicated clip its own scene with the original's direction", () => {
    const board: Board = { brief: "", nodes: [textNode("a", 0, { notes: "Hero" })], edges: [] };
    const before = synced(project([textClip("ca", 0, 2, "a")], board));
    const after = editAfter(before, (current) => duplicateClips(current, ["ca"]).project);
    const nodes = after.storyboard?.nodes ?? [];
    expect(nodes).toHaveLength(2);
    expect(nodes.map((node) => node.notes)).toEqual(["Hero", "Hero"]);
    const ids = after.videoTracks[0].clips.map((clip) => clip.storyboardNodeId);
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).toBe("a");
    expect(reconcileBoard(after, after)).toBe(after);
  });

  it("splits a scene in two when its clip is split", () => {
    const before = synced(project([textClip("a", 0, 4)]));
    const after = editAfter(before, (current) => splitClip(current, "a", 1)?.project ?? current);
    expect(story(after).map((entry) => entry.split(":")[1])).toEqual(["1", "3"]);
  });

  it("reads transitions from the clips' overlaps", () => {
    const b = { ...textClip("b", 1.5), transitionIn: "slide" as const };
    const result = synced(project([textClip("a", 0), b, textClip("c", 4)]));
    const transitions = result.storyboard?.edges.map((e) => [
      e.from,
      e.to,
      e.transition,
      e.transitionSeconds,
    ]);
    expect(transitions).toEqual([
      ["a", "b", "slide", 0.5],
      ["b", "c", "cut", 0],
    ]);
  });

  it("puts clips on another track in time order with a cut", () => {
    const result = synced(project([textClip("a", 0, 4)], undefined, [textClip("title", 1, 2)]));
    expect(story(result)).toEqual(["a:4", "title:2"]);
    expect(result.storyboard?.edges[0]).toMatchObject({ transition: "cut" });
  });

  it("keeps a generated draft's place and binds it once its clip lands", () => {
    const board: Board = {
      brief: "",
      nodes: [textNode("a", 0), textNode("b", 112)],
      edges: [edge("a", "b", "crossfade", 0.5)],
    };
    const before = synced(project([textClip("ca", 0, 2, "a")], board));
    const after = editAfter(before, (current) => applyGeneratedClips(current, "b", [textClip("cb", 0, 3)]));
    expect(story(after)).toEqual(["a:2", "b:3"]);
    expect(after.storyboard?.edges[0]).toMatchObject({ transition: "crossfade", transitionSeconds: 0.5 });
  });

  it("makes scenes again for clips whose nodes a new board dropped", () => {
    const board: Board = { brief: "", nodes: [textNode("a", 0, { notes: "Old" })], edges: [] };
    const before = synced(project([textClip("ca", 0, 2, "a")], board));
    const drafted: Board = { brief: "New", nodes: [textNode("plan", 0)], edges: [] };
    const after = editAfter(before, (current) => ({ ...current, storyboard: drafted }));
    expect(after.storyboard?.nodes.map((node) => node.id).sort()).toEqual(["a", "plan"]);
    const restored = editAfter(after, (current) => ({ ...current, storyboard: before.storyboard }));
    expect(restored.storyboard).toEqual(before.storyboard);
  });
});

describe("syncBoard", () => {
  it("trims a scene's clip when its duration changes on the board", () => {
    const before = synced(project([textClip("a", 0, 2), textClip("b", 4, 2)]));
    const after = editAfter(before, (current) => ({
      ...current,
      storyboard: {
        ...(current.storyboard as Board),
        nodes:
          current.storyboard?.nodes.map((node) => (node.id === "a" ? { ...node, duration: 3 } : node)) ?? [],
      },
    }));
    expect(after.videoTracks[0].clips.find((clip) => clip.id === "a")?.duration).toBe(3);
    expect(story(after)).toEqual(["a:3", "b:2"]);
  });

  it("overlaps neighbouring clips when the board's transition changes", () => {
    const before = synced(project([textClip("a", 0, 2), textClip("b", 2, 2)]));
    const [join] = before.storyboard?.edges ?? [];
    const after = editAfter(before, (current) => ({
      ...current,
      storyboard: {
        ...(current.storyboard as Board),
        edges: [{ ...join, transition: "crossfade", transitionSeconds: 0 }],
      },
    }));
    expect(after.videoTracks[0].clips.find((clip) => clip.id === "b")?.start).toBe(1.5);
    expect(after.storyboard?.edges[0]).toMatchObject({ transition: "crossfade", transitionSeconds: 0.5 });
  });

  it("lets a timeline-only edit through untouched apart from the board", () => {
    const before = synced(project([textClip("a", 0, 2)]));
    const after = editAfter(before, (current) => setClipDuration(current, "a", 1));
    expect(after.videoTracks[0].clips[0].duration).toBe(1);
    expect(story(after)).toEqual(["a:1"]);
  });
});

describe("removeScenes", () => {
  it("removes the scenes' clips too, leaving drafts' neighbours joined", () => {
    const before = synced(project([textClip("a", 0), textClip("b", 2), textClip("c", 4)]));
    const after = syncBoard(before, removeScenes(before, ["b"]));
    expect(after.videoTracks[0].clips.map((clip) => clip.id)).toEqual(["a", "c"]);
    expect(story(after)).toEqual(["a:2", "c:2"]);
  });
});

describe("reorderScene", () => {
  it("swaps two scenes' clips on the timeline", () => {
    const before = synced(project([textClip("a", 0, 2), textClip("b", 2.5, 3)]));
    const after = syncBoard(before, reorderScene(before, "a", 1));
    const spans = after.videoTracks[0].clips.map((clip) => [clip.id, clip.start]);
    expect(spans).toEqual([
      ["b", 0],
      ["a", 3.5],
    ]);
    expect(story(after)).toEqual(["b:3", "a:2"]);
  });

  it("moves a draft past a scene on the board only", () => {
    const board: Board = {
      brief: "",
      nodes: [textNode("a", 0), textNode("draft", 112)],
      edges: [edge("a", "draft")],
    };
    const before = synced(project([textClip("ca", 0, 2, "a")], board));
    const after = syncBoard(before, reorderScene(before, "draft", -1));
    expect(story(after)).toEqual(["draft:2", "a:2"]);
    expect(after.videoTracks).toBe(before.videoTracks);
  });

  it("does nothing when the scenes' clips are on different tracks", () => {
    const before = synced(project([textClip("a", 0, 4)], undefined, [textClip("t", 1, 2)]));
    expect(reorderScene(before, "a", 1)).toBe(before);
  });
});
