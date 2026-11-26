import { describe, expect, it } from "vitest";
import { type Board, EMPTY_BOARD } from "../storyboard/board-schema";
import { type AgentEvent, agentChatRequestSchema, agentSystemPrompt, agentTools } from "./agent-chat";
import type { BoardDraft, BoardPlanner } from "./board-draft";

const DRAFT: BoardDraft = {
  brief: "Introducing vaunt",
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

function run(board: Board, planner: BoardPlanner) {
  const events: AgentEvent[] = [];
  const tools = agentTools(board, (event) => events.push(event), { pages: [], planner });
  // The tools' execute functions, called as the model would; the options argument is unused by them.
  const call = (name: string, input: unknown) =>
    (tools[name] as { execute: (input: unknown, options: unknown) => Promise<unknown> }).execute(input, {});
  return { events, call };
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

  it("revises only the scene asked for, keeping where it sits", async () => {
    const { events: drafted, call: first } = run(EMPTY_BOARD, async () => DRAFT);
    await first("draftStoryboard", { request: "x", totalSeconds: 30 });
    const board = drafted.find((event) => event.type === "board");
    if (board?.type !== "board") throw new Error("no board");
    const hook = board.board.nodes[0];
    if (!hook) throw new Error("no hook");

    const { events, call } = run(board.board, async () => ({
      ...DRAFT,
      nodes: DRAFT.nodes.map((node) =>
        node.kind === "text"
          ? { ...node, id: hook.id, title: "Sharper hook", words: "Still by email?" }
          : node
      ),
    }));
    await call("reviseScene", { sceneId: hook.id, instruction: "Make it a question" });
    const scene = events.find((event) => event.type === "scene");
    if (scene?.type !== "scene") throw new Error("no scene");
    expect(scene.node).toMatchObject({ id: hook.id, title: "Sharper hook", position: hook.position });
  });

  it("says so when the scene doesn't exist", async () => {
    const { events, call } = run(EMPTY_BOARD, async () => DRAFT);
    expect(await call("reviseScene", { sceneId: "nope", instruction: "x" })).toEqual({
      failed: "There's no scene with id nope.",
    });
    expect(events).toEqual([]);
  });

  it("sets the theme", async () => {
    const { events, call } = run(EMPTY_BOARD, async () => DRAFT);
    await call("setTheme", { theme: "dark" });
    expect(events).toEqual([{ type: "theme", theme: "dark" }]);
  });
});
