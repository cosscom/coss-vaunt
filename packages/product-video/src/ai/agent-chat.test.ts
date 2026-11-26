import { describe, expect, it } from "vitest";
import { type Board, EMPTY_BOARD } from "../storyboard/board-schema";
import { type AgentEvent, agentChatRequestSchema, agentSystemPrompt, agentTools } from "./agent-chat";
import type { BoardDraft, BoardPlanner } from "./board-draft";

const DRAFT: BoardDraft = {
  brief: "Introducing vaunt",
  rationale: "A hook, then the Links page. Left out search; the request didn't mention it.",
  nodes: [
    { id: "hook", kind: "text", title: "Hook", notes: "", duration: 2, words: "Introducing vaunt" },
    {
      id: "links",
      kind: "recording",
      title: "Open Links",
      notes: "Click Links in the sidebar",
      duration: 4,
      route: "/home",
      startFrom: "fresh",
    },
  ],
  edges: [{ from: "hook", to: "links", transition: "crossfade", transitionSeconds: 0.4 }],
};

function run(board: Board, planner: BoardPlanner, lockedScenes: string[] = []) {
  const events: AgentEvent[] = [];
  let counter = 0;
  const tools = agentTools(board, (event) => events.push(event), {
    pages: [],
    planner,
    newId: () => `new-${++counter}`,
    lockedScenes,
  });
  // The tools' execute functions, called as the model would; the options argument is unused by them.
  const call = (name: string, input: unknown) =>
    (tools[name] as { execute: (input: unknown, options: unknown) => Promise<unknown> }).execute(input, {});
  return { events, call };
}

/** A drafted board with real (laid out) ids: a hook, then the Links recording. */
async function drafted(): Promise<Board> {
  const { events, call } = run(EMPTY_BOARD, async () => DRAFT);
  await call("draftStoryboard", { request: "x", totalSeconds: 30 });
  const board = events.find((event) => event.type === "board");
  if (board?.type !== "board") throw new Error("no board");
  return board.board;
}

describe("agentChatRequestSchema", () => {
  const request = (messages: unknown) => ({ messages, context: "", board: EMPTY_BOARD });

  it("takes a conversation that ends with the author's message", () => {
    expect(
      agentChatRequestSchema.safeParse(
        request([
          { role: "user", content: "Make a launch video" },
          { role: "assistant", content: "How long?" },
          { role: "user", content: "30 s" },
        ])
      ).success
    ).toBe(true);
  });

  it("rejects one that ends with the agent, is empty, or has a blank message", () => {
    expect(agentChatRequestSchema.safeParse(request([{ role: "assistant", content: "Hi" }])).success).toBe(
      false
    );
    expect(agentChatRequestSchema.safeParse(request([])).success).toBe(false);
    expect(agentChatRequestSchema.safeParse(request([{ role: "user", content: "  " }])).success).toBe(false);
  });
});

describe("agentSystemPrompt", () => {
  it("carries the director skill, its catalogues and the project", () => {
    const prompt = agentSystemPrompt("Project “Launch”, 16:9");
    expect(prompt).toContain("# Video director");
    expect(prompt).toContain("How long should your video be from start to finish?");
    expect(prompt).toContain("## Text effects");
    expect(prompt).toContain("`crossfade`");
    expect(prompt).toContain("<project>\nProject “Launch”, 16:9\n</project>");
  });
});

describe("agentTools", () => {
  it("asks the author a question with replies", async () => {
    const { events, call } = run(EMPTY_BOARD, async () => DRAFT);
    await call("askAuthor", { question: "How long?", options: ["15 s", "30 s"] });
    expect(events).toEqual([{ type: "ask", question: "How long?", options: ["15 s", "30 s"] }]);
  });

  it("drafts a laid-out board and reports it", async () => {
    const { events, call } = run(EMPTY_BOARD, async () => DRAFT);
    const result = await call("draftStoryboard", {
      request: "Introducing vaunt, then Links",
      totalSeconds: 30,
    });
    expect(events[0]).toEqual({ type: "status", label: "Drafting the storyboard…" });
    const boardEvent = events[1];
    if (boardEvent?.type !== "board") throw new Error("no board");
    expect(boardEvent.summary).toBe("2 scenes, 6 s");
    expect(boardEvent.board.brief).toBe("Introducing vaunt, then Links");
    expect(boardEvent.board.nodes.map((node) => node.position.y)).toEqual([0, 112]);
    expect(result).toMatchObject({ drafted: "2 scenes, 6 s" });
  });

  it("returns the planner's reasons with the draft", async () => {
    const { events, call } = run(EMPTY_BOARD, async () => DRAFT);
    const result = await call("draftStoryboard", { request: "x", totalSeconds: 30 });
    expect(result).toMatchObject({ rationale: DRAFT.rationale });
    expect(events[1]).toMatchObject({ type: "board", rationale: DRAFT.rationale });
  });

  it("edits one scene without the planner, keeping where it sits", async () => {
    const board = await drafted();
    const hook = board.nodes[0];
    if (!hook) throw new Error("no hook");
    const { events, call } = run(board, async () => {
      throw new Error("the planner isn't needed");
    });
    expect(
      await call("editScene", {
        sceneId: hook.id,
        patch: { title: "Sharper hook", words: "Still by email?" },
      })
    ).toEqual({ done: "Edited “Sharper hook”: title, words" });
    expect(events).toEqual([
      {
        type: "scene",
        nodeId: hook.id,
        node: { ...hook, title: "Sharper hook", words: "Still by email?" },
        summary: "Edited “Sharper hook”: title, words",
      },
    ]);
  });

  it("hands a bad edit back to the model and changes nothing", async () => {
    const board = await drafted();
    const links = board.nodes[1];
    if (!links) throw new Error("no links");
    const { events, call } = run(board, async () => DRAFT);
    expect(await call("setSceneDuration", { sceneId: links.id, seconds: 20 })).toMatchObject({
      failed: expect.stringContaining("at most 8 s"),
    });
    expect(await call("editScene", { sceneId: "nope", patch: { title: "x" } })).toEqual({
      failed: "There's no scene with id nope.",
    });
    expect(events).toEqual([]);
  });

  it("leaves scenes on a locked track alone, saying why", async () => {
    const board = await drafted();
    const [hook, links] = board.nodes;
    if (!hook || !links) throw new Error("no scenes");
    const { events, call } = run(board, async () => DRAFT, [hook.id]);
    const locked = { failed: expect.stringContaining("is on a locked track") };
    expect(await call("removeScene", { sceneId: hook.id })).toMatchObject(locked);
    expect(await call("moveScene", { sceneId: hook.id, position: 2 })).toMatchObject(locked);
    expect(await call("setSceneDuration", { sceneId: hook.id, seconds: 3 })).toMatchObject(locked);
    expect(
      await call("setTransition", { fromSceneId: hook.id, toSceneId: links.id, kind: "cut" })
    ).toMatchObject(locked);
    expect(events).toEqual([]);
    expect(await call("editScene", { sceneId: hook.id, patch: { title: "Hello" } })).toMatchObject({
      done: expect.any(String),
    });
  });

  it("adds, moves and removes scenes in story order, each step building on the last", async () => {
    const board = await drafted();
    const { events, call } = run(board, async () => DRAFT);
    const added = await call("addScene", {
      scene: { kind: "text", title: "End card", notes: "", duration: 2, words: "Try vaunt" },
    });
    expect(added).toMatchObject({ done: "Added “End card” as scene 3" });
    await call("moveScene", { sceneId: "new-1", position: 1 });
    const removed = await call("removeScene", { sceneId: board.nodes[1]?.id });
    expect(removed).toMatchObject({
      scenes: [expect.stringContaining("End card"), expect.stringContaining("Hook")],
    });
    const edits = events.filter((event) => event.type === "edit");
    expect(edits.map((event) => event.summary)).toEqual([
      "Added “End card” as scene 3",
      "Moved “End card” to scene 1",
      "Removed “Open Links”",
    ]);
    const last = edits.at(-1);
    if (last?.type !== "edit") throw new Error("no edit");
    expect(last.board.edges).toHaveLength(1);
  });

  it("sets the transition between consecutive scenes", async () => {
    const board = await drafted();
    const [hook, links] = board.nodes;
    if (!hook || !links) throw new Error("no scenes");
    const { events, call } = run(board, async () => DRAFT);
    await call("setTransition", {
      fromSceneId: hook.id,
      toSceneId: links.id,
      kind: "zoom-through",
      seconds: 0.8,
    });
    const edit = events[0];
    if (edit?.type !== "edit") throw new Error("no edit");
    expect(edit.board.edges).toEqual([
      { ...board.edges[0], transition: "zoom-through", transitionSeconds: 0.8 },
    ]);
    expect(
      await call("setTransition", { fromSceneId: links.id, toSceneId: hook.id, kind: "cut" })
    ).toMatchObject({
      failed: expect.stringContaining("is the last scene"),
    });
  });

  it("sets the theme", async () => {
    const { events, call } = run(EMPTY_BOARD, async () => DRAFT);
    await call("setTheme", { theme: "dark" });
    expect(events).toEqual([{ type: "theme", theme: "dark" }]);
  });
});
