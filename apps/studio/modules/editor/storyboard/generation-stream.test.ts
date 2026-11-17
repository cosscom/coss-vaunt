import { createTextClip } from "@calcom/product-video/storyboard/storyboard-factories";
import { describe, expect, it } from "vitest";
import { applyGenerationEvent, failUnfinished, parseGenerationStream } from "./generation-stream";

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
