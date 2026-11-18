import { describe, expect, it } from "vitest";
import { ROUTE_CATALOGUE } from "../catalogues/routes/route-catalogue";
import type { Board } from "../storyboard/board-schema";
import {
  type BoardDraft,
  type BoardPlanner,
  draftBoard,
  NODE_SPACING,
  repairBoardDraft,
} from "./board-draft";
import { boardDraftSystemPrompt, boardDraftUserPrompt } from "./board-draft-prompt";
import { NoSubmissionError } from "./submit-tool-loop";

const draft: BoardDraft = {
  brief: "Show the Main Agent booking a meeting.",
  nodes: [
    { id: "end", kind: "text", title: "End card", notes: "", duration: 2, words: "Cal.com", effect: "nope" },
    {
      id: "ask",
      kind: "recording",
      title: "Ask",
      notes: "Type the request and send it",
      duration: 6,
      route: "/home",
      startFrom: "previous",
    },
    {
      id: "hook",
      kind: "text",
      title: "Hook",
      notes: "",
      duration: 2,
      words: "Meet your agent",
      effect: "typewriter",
    },
  ],
  edges: [
    { from: "hook", to: "ask", transition: "crossfade", transitionSeconds: 0.5 },
    { from: "ask", to: "end", transition: "cut", transitionSeconds: 1 },
    { from: "ask", to: "ghost", transition: "slide", transitionSeconds: 0.5 },
  ],
};

let counter = 0;
const newId = () => `id-${++counter}`;

describe("repairBoardDraft", () => {
  it("lays scenes out in story order, fixes what it can and keeps a valid board", () => {
    const { board, errors } = repairBoardDraft(draft, { newId });
    expect(errors).toEqual([]);
    const nodes = board?.nodes ?? [];
    expect(nodes.map((node) => node.title)).toEqual(["Hook", "Ask", "End card"]);
    expect(nodes.map((node) => node.position.y)).toEqual([0, NODE_SPACING, 2 * NODE_SPACING]);
    expect(nodes[1]).toMatchObject({ kind: "recording", startFrom: "fresh" });
    expect(nodes[2]).not.toHaveProperty("effect");
    expect(board?.edges).toHaveLength(2);
    expect(board?.edges[1]).toMatchObject({ transition: "cut", transitionSeconds: 0 });
  });

  it("takes any app path and rejects anything else", () => {
    const withRoute = (route: string): BoardDraft => ({
      ...draft,
      nodes: draft.nodes.map((node) => (node.kind === "recording" ? { ...node, route } : node)),
    });
    expect(repairBoardDraft(withRoute("/settings/my-account/profile"), { newId }).errors).toEqual([]);
    expect(repairBoardDraft(withRoute("//evil.example"), { newId }).errors).toEqual([
      'Scene "ask" route //evil.example isn\'t a path in the app, like /bookings/upcoming',
    ]);
  });

  it("keeps the ids of scenes from the board being revised", () => {
    const existing: Board = { brief: "", edges: [], nodes: [] };
    const revised = repairBoardDraft(draft, {
      newId,
      existing: {
        ...existing,
        nodes: [
          {
            id: "ask",
            kind: "text",
            title: "Old",
            notes: "",
            duration: 2,
            words: "",
            position: { x: 0, y: 0 },
          },
        ],
      },
    });
    expect(revised.board?.nodes.map((node) => node.id)).toContain("ask");
  });
});

describe("board draft prompts", () => {
  it("lists the catalogue, the cap and the target length", () => {
    const system = boardDraftSystemPrompt({
      routes: ROUTE_CATALOGUE,
      effects: [{ id: "typewriter", description: "Types the words" }],
      totalSeconds: 20,
    });
    expect(system).toContain("about 20 seconds");
    expect(system).toContain("Never add recordings to fill time");
    expect(system).toContain("at most 8 seconds");
    expect(system).toContain("- /home (Home · Main Agent)");
    expect(system).toContain("composer: The chat composer");
    expect(system).toContain("- typewriter: Types the words");
    expect(system).toContain("- zoom-through:");
  });

  it("sends a revised board without positions", () => {
    const prompt = boardDraftUserPrompt({
      prompt: "Make it shorter",
      board: {
        brief: "b",
        edges: [],
        nodes: [
          {
            id: "a",
            kind: "text",
            title: "A",
            notes: "",
            duration: 2,
            words: "Hi",
            position: { x: 3, y: 4 },
          },
        ],
      },
    });
    expect(prompt).toContain("<request>\nMake it shorter\n</request>");
    expect(prompt).toContain('"id": "a"');
    expect(prompt).not.toContain("position");
  });

  it("scopes a revision to the focused scene", () => {
    const node = {
      id: "a",
      kind: "text" as const,
      title: "Opening",
      notes: "",
      duration: 2,
      words: "Hi",
      position: { x: 0, y: 0 },
    };
    const board = { brief: "b", edges: [], nodes: [node] };
    expect(boardDraftUserPrompt({ prompt: "Punchier", board, focusNodeId: "a" })).toContain(
      'one scene only: "a" (Opening)'
    );
    expect(boardDraftUserPrompt({ prompt: "Punchier", board, focusNodeId: "gone" })).not.toContain(
      "one scene only"
    );
  });
});

describe("draftBoard", () => {
  it("validates drafts through the planner and returns the repaired board", async () => {
    const planner: BoardPlanner = async ({ check }) => {
      const outside = draft.nodes.map((node) =>
        node.kind === "recording" ? { ...node, route: "//nowhere" } : node
      );
      expect(check({ ...draft, nodes: outside })).toHaveLength(1);
      expect(check(draft)).toEqual([]);
      return draft;
    };
    const board = await draftBoard({ prompt: "Book Sandy", routes: ["/home"], totalSeconds: 20, planner });
    expect(board.nodes).toHaveLength(3);
  });

  it("refuses featured routes that aren't app paths", async () => {
    const planner: BoardPlanner = async () => draft;
    await expect(
      draftBoard({ prompt: "x", routes: ["//nowhere"], totalSeconds: 20, planner })
    ).rejects.toThrow(/Not paths in the app/);
  });

  it("explains a request it can't plan with the model's own reason", async () => {
    const planner: BoardPlanner = async () => {
      throw new NoSubmissionError("stopped", "The app has no page for editing invoices.");
    };
    await expect(
      draftBoard({ prompt: "Edit an invoice", routes: [], totalSeconds: 20, planner })
    ).rejects.toThrow("The app has no page for editing invoices.");
  });
});
