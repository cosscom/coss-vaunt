import { createTextClip } from "@coss/vaunt-engine/storyboard/storyboard-factories";
import { describe, expect, it } from "vitest";
import { applyGenerationEvent, failUnfinished, parseGenerationStream, shownSteps } from "./generation-stream";

describe("parseGenerationStream", () => {
  it("returns complete events and keeps the unfinished tail", () => {
    const { events, rest } = parseGenerationStream(
      'data: {"nodeId":"a","status":"queued"}\n\ndata: {"nodeId":"b","status":"expl'
    );
    expect(events).toEqual([{ nodeId: "a", status: "queued" }]);
    expect(rest).toBe('data: {"nodeId":"b","status":"expl');
    expect(parseGenerationStream(`${rest}oring","progress":0.5}\n\n`).events).toEqual([
      { nodeId: "b", status: "exploring", progress: 0.5 },
    ]);
  });

  it("reads clips, the done event, CRLF and multi-line data, and skips comments and junk", () => {
    const clip = createTextClip({ text: "Hello" });
    const stream = [
      ": keep-alive",
      "",
      `data: ${JSON.stringify({ nodeId: "a", status: "done", clips: [clip] })}`,
      "",
      "data: not json",
      "",
      'data: {"nodeId":"a",\r\ndata: "status":"nope"}',
      "",
      'event: message\r\ndata: {"done":true}',
      "",
      "",
    ].join("\n");
    expect(parseGenerationStream(stream).events).toEqual([
      { nodeId: "a", status: "done", clips: [clip] },
      { done: true },
    ]);
  });
});

describe("node statuses", () => {
  it("tracks the latest status per node and fails the unfinished ones when the stream drops", () => {
    let statuses = applyGenerationEvent({}, { nodeId: "a", status: "done" });
    statuses = applyGenerationEvent(statuses, { nodeId: "b", status: "recording", message: "Frame 12" });
    expect(failUnfinished(statuses, "Lost connection")).toEqual({
      a: { status: "done", message: undefined, progress: undefined },
      b: { status: "failed", message: "Lost connection" },
    });
  });
});

describe("shownSteps", () => {
  it("keeps the agent's messages in order, without repeats, and shows the last three", () => {
    let statuses = applyGenerationEvent({}, { nodeId: "a", status: "queued" });
    for (const message of [
      "Signing in",
      "Opening /home",
      "Reading the page",
      "Reading the page",
      "Found the target",
    ])
      statuses = applyGenerationEvent(statuses, { nodeId: "a", status: "exploring", message });
    statuses = applyGenerationEvent(statuses, { nodeId: "a", status: "recording", progress: 0.5 });
    expect(shownSteps(statuses.a!)).toEqual({
      finished: ["Opening /home", "Reading the page"],
      current: "Found the target",
    });
  });

  it("starts over when the scene is queued again, and shows nothing once it's finished", () => {
    let statuses = applyGenerationEvent({}, { nodeId: "a", status: "exploring", message: "Signing in" });
    statuses = applyGenerationEvent(statuses, { nodeId: "a", status: "queued" });
    expect(statuses.a?.steps).toBeUndefined();
    statuses = applyGenerationEvent(statuses, { nodeId: "a", status: "done" });
    expect(shownSteps(statuses.a!)).toEqual({ finished: [], current: null });
  });
});
