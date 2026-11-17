import { describe, expect, it } from "vitest";
import { readImportEvents } from "./youtube-import-events";

describe("readImportEvents", () => {
  it("returns complete lines as events and keeps the partial tail", () => {
    const { events, rest } = readImportEvents(
      '{"type":"progress","progress":{"stage":"downloading","percent":12}}\n\n{"type":"error","mess'
    );
    expect(events).toEqual([{ type: "progress", progress: { stage: "downloading", percent: 12 } }]);
    expect(rest).toBe('{"type":"error","mess');
  });
});
