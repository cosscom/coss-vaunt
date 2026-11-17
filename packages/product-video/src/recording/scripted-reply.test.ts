import { describe, expect, it } from "vitest";
import { type ScriptedReplyFixture, scriptedReplyFixtureSchema, scriptedTurnChunks } from "./scripted-reply";

const fixture: ScriptedReplyFixture = {
  title: "Book a 1on1",
  turns: [
    {
      steps: [
        [
          { kind: "pause", ms: 300 },
          { kind: "reasoning", text: "Checking Sandy.", ms: 200 },
          {
            kind: "tool",
            toolName: "find_booking_links",
            input: { query: "Sandy" },
            output: { links: [] },
            ms: 500,
          },
        ],
        [
          { kind: "text", text: "Here you go.", ms: 400 },
          { kind: "approval", toolName: "create_booking", input: { start: "x" }, display: { title: "1on1" } },
        ],
      ],
    },
    { steps: [[{ kind: "text", text: "Booked.", ms: 100 }]] },
  ],
};

describe("scriptedReplyFixtureSchema", () => {
  it("rejects an empty reply and unknown part kinds", () => {
    expect(scriptedReplyFixtureSchema.safeParse({ title: "t", turns: [] }).success).toBe(false);
    expect(
      scriptedReplyFixtureSchema.safeParse({ title: "t", turns: [{ steps: [[{ kind: "video" }]] }] }).success
    ).toBe(false);
    expect(
      scriptedReplyFixtureSchema.safeParse({ title: "t", turns: [{ steps: [[{ kind: "pause", ms: -1 }]] }] })
        .success
    ).toBe(false);
  });
});

describe("scriptedTurnChunks", () => {
  const chunks = scriptedTurnChunks(fixture, 0);
  const types = chunks.map(({ chunk }) => chunk.type);

  it("wraps steps in a message and streams parts in order", () => {
    expect(types[0]).toBe("start");
    expect(types.at(-1)).toBe("finish");
    expect(types.filter((type) => type === "start-step").length).toBe(2);
    expect(types.indexOf("reasoning-start")).toBeLessThan(types.indexOf("tool-input-start"));
    expect(types.slice(-6)).toEqual([
      "tool-input-start",
      "tool-input-available",
      "data-approval-display",
      "tool-approval-request",
      "finish-step",
      "finish",
    ]);
  });

  it("streams text word by word and rebuilds it exactly", () => {
    const text = chunks.flatMap(({ chunk }) => (chunk.type === "text-delta" ? [chunk.delta] : [])).join("");
    expect(text).toBe("Here you go.");
  });

  it("keys the approval display to the tool call", () => {
    const display = chunks.find(({ chunk }) => chunk.type === "data-approval-display")?.chunk;
    const request = chunks.find(({ chunk }) => chunk.type === "tool-approval-request")?.chunk;
    expect(display?.id).toBe(request?.toolCallId);
  });

  it("never goes back in time and honours pauses and tool latency", () => {
    const times = chunks.map(({ atMs }) => atMs);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(chunks.find(({ chunk }) => chunk.type === "reasoning-start")?.atMs).toBe(300);
    const input = chunks.find(({ chunk }) => chunk.type === "tool-input-available");
    const output = chunks.find(({ chunk }) => chunk.type === "tool-output-available");
    expect((output?.atMs ?? 0) - (input?.atMs ?? 0)).toBe(500);
  });

  it("replays the last turn when the user sends more turns than scripted", () => {
    const shape = (turn: number) =>
      scriptedTurnChunks(fixture, turn).map(({ atMs, chunk }) => [atMs, chunk.type]);
    expect(shape(5)).toEqual(shape(1));
    expect(scriptedTurnChunks(fixture, 5)[2].chunk.id).not.toBe(scriptedTurnChunks(fixture, 1)[2].chunk.id);
  });
});
