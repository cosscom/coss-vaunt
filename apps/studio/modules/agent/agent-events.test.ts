import { EMPTY_BOARD } from "@coss/vaunt-engine/storyboard/board-schema";
import { describe, expect, it } from "vitest";
import { boardAfter, historyContent, takeEvents } from "./agent-events";

describe("takeEvents", () => {
  it("parses whole lines and keeps the unfinished one", () => {
    const { events, rest } = takeEvents('{"type":"text","delta":"Hi"}\n{"type":"status","label":"Dr');
    expect(events).toEqual([{ type: "text", delta: "Hi" }]);
    expect(rest).toBe('{"type":"status","label":"Dr');
  });

  it("skips blank and broken lines", () => {
    expect(takeEvents('\n{nope}\n{"type":"theme","theme":"dark"}\n').events).toEqual([
      { type: "theme", theme: "dark" },
    ]);
  });
});

describe("historyContent", () => {
  it("adds what the agent asked and changed, and what was undone", () => {
    expect(
      historyContent({
        id: "1",
        role: "assistant",
        content: "Here's a first pass.",
        ask: { question: "How long?", options: ["15 s", "30 s"] },
        changes: [
          {
            id: "a",
            kind: "board",
            summary: "Drafted the storyboard: 3 scenes, 7 s",
            before: EMPTY_BOARD,
            undone: true,
          },
          { id: "b", kind: "theme", summary: "Set the theme to dark", before: "light" },
        ],
      })
    ).toBe(
      "Here's a first pass.\n\n[Asked the author: How long? Replies: 15 s / 30 s]\n\n" +
        "[Drafted the storyboard: 3 scenes, 7 s; the author undid this]\n\n[Set the theme to dark]"
    );
  });

  it("is just the question when the agent only asked", () => {
    expect(
      historyContent({
        id: "1",
        role: "assistant",
        content: "",
        ask: { question: "Light or dark?", options: ["Light", "Dark"] },
      })
    ).toBe("[Asked the author: Light or dark? Replies: Light / Dark]");
  });
});

describe("historyContent with a draft's reasons", () => {
  it("keeps why the planner chose the scenes", () => {
    expect(
      historyContent({
        id: "1",
        role: "assistant",
        content: "",
        changes: [
          {
            id: "a",
            kind: "board",
            summary: "Drafted the storyboard: 3 scenes, 7 s",
            before: EMPTY_BOARD,
            rationale: "Left out search.",
          },
        ],
      })
    ).toBe("[Drafted the storyboard: 3 scenes, 7 s. Why these scenes: Left out search.]");
  });
});

describe("boardAfter", () => {
  const hook = {
    id: "hook",
    kind: "text" as const,
    title: "Hook",
    notes: "",
    duration: 2,
    words: "Hi",
    position: { x: 0, y: 0 },
  };
  const board = { ...EMPTY_BOARD, nodes: [hook] };

  it("replaces the board for a draft or an edit", () => {
    const next = { ...EMPTY_BOARD, brief: "new" };
    expect(boardAfter({ type: "board", board: next, summary: "" }, board)).toBe(next);
    expect(boardAfter({ type: "edit", board: next, summary: "" }, board)).toBe(next);
  });

  it("replaces just the scene for a scene edit, and nothing for other events", () => {
    const node = { ...hook, words: "Hello" };
    expect(boardAfter({ type: "scene", nodeId: "hook", node, summary: "" }, board)?.nodes).toEqual([node]);
    expect(boardAfter({ type: "theme", theme: "dark" }, board)).toBeNull();
  });
});
