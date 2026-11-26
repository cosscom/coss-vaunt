import { describe, expect, it } from "vitest";
import type { Board } from "../storyboard/board-schema";
import {
  type BoardDraft,
  type BoardPlanner,
  draftBoard,
  NODE_SPACING,
  repairBoardDraft,
  sceneRuleErrors,
} from "./board-draft";
import { boardDraftSystemPrompt, boardDraftUserPrompt } from "./board-draft-prompt";
import { NoSubmissionError } from "./submit-tool-loop";

const draft: BoardDraft = {
  brief: "Show the Main Agent booking a meeting.",
  rationale: "One recording of the ask, between a hook and an end card. Left out the settings page.",
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

describe("sceneRuleErrors", () => {
  it("holds routes to app paths and effects to the catalogue", () => {
    expect(sceneRuleErrors({ kind: "recording", route: "/home" }, "Ask")).toEqual([]);
    expect(sceneRuleErrors({ kind: "recording", route: "https://x.dev" }, "Ask")[0]).toContain(
      "isn't a path in the app"
    );
    expect(sceneRuleErrors({ kind: "text", effect: "typewriter" }, "Hook")).toEqual([]);
    expect(sceneRuleErrors({ kind: "text", effect: "nope" }, "Hook")[0]).toContain(
      'Scene "Hook" effect nope isn\'t a text effect; use one of'
    );
    expect(sceneRuleErrors({ kind: "text" }, "Hook")).toEqual([]);
  });
});

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
      'Scene "ask" route //evil.example isn\'t a path in the app, like /settings',
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
  it("lists the app's pages and notes, the cap and the target length", () => {
    const system = boardDraftSystemPrompt({
      pages: [
        { path: "/projects", label: "Projects", title: "Projects · Acme", inNav: true },
        { path: "/projects/new", label: "New project", title: "", inNav: false },
      ],
      appNotes: "Billing is off limits.",
      effects: [{ id: "typewriter", description: "Types the words" }],
      totalSeconds: 20,
    });
    expect(system).toContain("about 20 seconds");
    expect(system).toContain("Never add recordings to fill time");
    expect(system).toContain("at most 8 seconds");
    expect(system).toContain("- /projects (Projects · Projects · Acme), in the navigation");
    expect(system).toContain("- /projects/new (New project)\n");
    expect(system).toContain("<app-notes>\nBilling is off limits.\n</app-notes>");
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

  it("asks for the reasons behind the scenes", () => {
    expect(boardDraftSystemPrompt({ pages: [], effects: [], totalSeconds: 20 })).toContain(
      "Set the rationale"
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
    const { board, rationale } = await draftBoard({
      prompt: "Book Sandy",
      pages: [],
      totalSeconds: 20,
      planner,
    });
    expect(board.nodes).toHaveLength(3);
    expect(rationale).toBe(draft.rationale);
  });

  it("says when no pages were found rather than listing none", () => {
    const system = boardDraftSystemPrompt({ pages: [], effects: [], totalSeconds: 20 });
    expect(system).toContain("No pages were found by following the app's links");
    expect(system).not.toContain("<app-notes>");
  });

  it("explains a request it can't plan with the model's own reason", async () => {
    const planner: BoardPlanner = async () => {
      throw new NoSubmissionError("stopped", "The app has no page for editing invoices.");
    };
    await expect(
      draftBoard({ prompt: "Edit an invoice", pages: [], totalSeconds: 20, planner })
    ).rejects.toThrow("The app has no page for editing invoices.");
  });
});
