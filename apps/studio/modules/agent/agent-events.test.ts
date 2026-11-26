import { EMPTY_BOARD } from "@coss/vaunt-engine/storyboard/board-schema";
import { describe, expect, it } from "vitest";
import { historyContent, takeEvents } from "./agent-events";

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
