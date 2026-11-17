import { describe, expect, it } from "vitest";
import { DEFAULT_CURSOR, resolveCursorSettings, setCursorSettings } from "./cursor-settings";
import { createRecordingClip, createTextClip } from "./storyboard-factories";

describe("cursor settings", () => {
  const recording = createRecordingClip({ name: "Book", route: "/bookings" });

  it("defaults recordings to a visible arrow at size 1, and other clips to no cursor", () => {
    expect(resolveCursorSettings(recording)).toEqual({ visible: true, size: 1, style: "arrow" });
    expect(resolveCursorSettings(createTextClip({ text: "Hi" }))).toBeNull();
  });

  it("changes one setting and keeps the rest", () => {
    const hidden = setCursorSettings(recording, { visible: false });
    expect(resolveCursorSettings(hidden)).toEqual({ ...DEFAULT_CURSOR, visible: false });
    expect(resolveCursorSettings(setCursorSettings(hidden, { style: "dot" }))).toEqual({
      ...DEFAULT_CURSOR,
      visible: false,
      style: "dot",
    });
  });
});
