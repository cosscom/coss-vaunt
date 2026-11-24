import { describe, expect, it } from "vitest";
import type { Board, BoardNode } from "../storyboard/board-schema";
import { createProject } from "../storyboard/storyboard-factories";
import type { Project } from "../storyboard/storyboard-schema";
import { type GenerateBoardDeps, generateBoard } from "./generate-board";
import type { GenerationEvent } from "./generation-events";
import { defaultTextEffect } from "./node-clips";

const composer = "[data-testid=ai-chat-input]";
const recordingNode = (id: string, y: number, startFrom: "fresh" | "previous"): BoardNode => ({
  id,
  kind: "recording",
  title: id,
  notes: "Type into the composer",
  duration: 4,
  position: { x: 0, y },
  route: "/home",
  startFrom,
});

const board: Board = {
  brief: "",
  nodes: [
    {
      id: "hook",
      kind: "text",
      title: "Hook",
      notes: "",
      duration: 2,
      position: { x: 0, y: 0 },
      words: "Meet it",
    },
    recordingNode("ask", 100, "fresh"),
    recordingNode("approve", 200, "previous"),
    { id: "logo", kind: "media", title: "Logo", notes: "", duration: 2, position: { x: 0, y: 300 } },
  ],
  edges: [
    { id: "e1", from: "hook", to: "ask", transition: "crossfade", transitionSeconds: 0.5 },
    { id: "e2", from: "ask", to: "approve", transition: "cut", transitionSeconds: 0 },
  ],
};

const project: Project = createProject({ name: "Demo", now: new Date("2026-11-18T08:00:00Z") });

function fakeDeps(recorded: Project[]): GenerateBoardDeps {
  return {
    explore: async ({ node, previous, rehearse, onProgress }) => {
      onProgress("Found the composer");
      expect(await rehearse([{ kind: "move", at: 1, target: "#late" }])).toEqual(["#late shows 1.0 s later"]);
      const text = previous ? "Approve" : "Book Sandy";
      return { script: { actions: [{ kind: "type", at: node.duration / 4, target: composer, text }] } };
    },
    rehearse: async ({ project: rehearsed, clipId }) => {
      const clip = rehearsed.videoTracks
        .flatMap((track) => track.clips)
        .find((candidate) => candidate.id === clipId);
      if (clip?.source.kind === "recording" && clip.source.actions[0]?.kind === "move") {
        throw new Error("#late shows 1.0 s later");
      }
    },
    record: async ({ project: withClip, onProgress }) => {
      recorded.push(withClip);
      onProgress({ type: "frame", frame: 1, frameCount: 2, elapsedSeconds: 1, etaSeconds: 1 });
      return { directory: "/tmp/x" };
    },
  };
}

describe("generateBoard", () => {
  it("generates nodes in story order and chains recordings", async () => {
    const events: GenerationEvent[] = [];
    const recorded: Project[] = [];
    await generateBoard({ project, board, emit: (event) => events.push(event), deps: fakeDeps(recorded) });

    const statuses = events.map((event) => ("done" in event ? "end" : `${event.nodeId}:${event.status}`));
    expect(statuses.slice(0, 4)).toEqual(["hook:queued", "ask:queued", "approve:queued", "logo:queued"]);
    expect(statuses).toContain("ask:exploring");
    expect(statuses).toContain("ask:recording");
    expect(statuses.at(-2)).toBe("logo:failed");
    expect(statuses.at(-1)).toBe("end");

    const doneClips = (nodeId: string) =>
      events.flatMap((event) => ("nodeId" in event && event.nodeId === nodeId && event.clips) || []);
    const hook = doneClips("hook")[0];
    expect(hook.source).toMatchObject({ kind: "text", effectIn: defaultTextEffect("Meet it") });
    const ask = doneClips("ask")[0];
    const approve = doneClips("approve")[0];
    expect(approve.source).toMatchObject({ kind: "recording", startFrom: { clipId: ask.id } });
    // The recorder sees the predecessor on the timeline, so it can replay it.
    expect(recorded[1].videoTracks[0].clips.map((clip) => clip.id)).toEqual([hook.id, ask.id, approve.id]);
  });

  it("regenerates one node under its existing clip id", async () => {
    const first: GenerationEvent[] = [];
    await generateBoard({ project, board, emit: (event) => first.push(event), deps: fakeDeps([]) });
    const askId = first.flatMap(
      (event) => ("nodeId" in event && event.nodeId === "ask" && event.clips) || []
    )[0]?.id;
    const withAsk: Project = {
      ...project,
      videoTracks: [
        {
          ...project.videoTracks[0],
          clips: first.flatMap((event) => ("nodeId" in event && event.nodeId === "ask" && event.clips) || []),
        },
      ],
    };
    const again: GenerationEvent[] = [];
    await generateBoard({
      project: withAsk,
      board,
      nodeIds: ["approve"],
      emit: (event) => again.push(event),
      deps: fakeDeps([]),
    });
    const approve = again.find((event) => "nodeId" in event && event.status === "done");
    expect(approve && "clips" in approve && approve.clips?.[0].source).toMatchObject({
      startFrom: { clipId: askId },
    });
    expect(again.filter((event) => "nodeId" in event && event.status === "queued")).toHaveLength(1);
  });

  it("records the scenes that continue a regenerated one again, with their own scripts", async () => {
    const firstRecorded: Project[] = [];
    await generateBoard({ project, board, emit: () => undefined, deps: fakeDeps(firstRecorded) });
    const again: GenerationEvent[] = [];
    const recorded: Project[] = [];
    await generateBoard({
      project: firstRecorded[1],
      board,
      nodeIds: ["ask"],
      emit: (event) => again.push(event),
      deps: fakeDeps(recorded),
    });
    const approve = again.filter((event) => "nodeId" in event && event.nodeId === "approve");
    expect(approve.map((event) => "status" in event && event.status)).toContain("recording");
    expect(approve.at(-1)).toEqual({ nodeId: "approve", status: "done" });
    expect(recorded).toHaveLength(2);
  });

  it("writes the words for a title card left blank", async () => {
    const blank: Board = {
      brief: "Show off the agent",
      nodes: [{ ...board.nodes[0], kind: "text", words: " " } as BoardNode],
      edges: [],
    };
    const events: GenerationEvent[] = [];
    await generateBoard({
      project,
      board: blank,
      emit: (event) => events.push(event),
      deps: { ...fakeDeps([]), writeWords: async (_node, brief) => `${brief}, fast` },
    });
    const done = events.find((event) => "nodeId" in event && event.status === "done");
    expect(done && "clips" in done && done.clips?.[0].source).toMatchObject({
      text: "Show off the agent, fast",
    });
  });

  it("fails recording scenes for a project that only uses its own files", async () => {
    const events: GenerationEvent[] = [];
    const filesOnly: Project = { ...project, settings: { ...project.settings, app: { kind: "none" } } };
    await generateBoard({
      project: filesOnly,
      board,
      nodeIds: ["ask"],
      emit: (event) => events.push(event),
      deps: fakeDeps([]),
    });
    expect(events).toContainEqual({
      nodeId: "ask",
      status: "failed",
      message: "This project uses your own files, so it has no app to record",
    });
  });

  it("fails a continuing recording whose predecessor has no clip", async () => {
    const events: GenerationEvent[] = [];
    await generateBoard({
      project,
      board,
      nodeIds: ["approve"],
      emit: (event) => events.push(event),
      deps: fakeDeps([]),
    });
    expect(events).toContainEqual({
      nodeId: "approve",
      status: "failed",
      message: "Generate the recording scene before this one first",
    });
  });
});
