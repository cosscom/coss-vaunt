import { describe, expect, it } from "vitest";
import { recordingFrameAt, videoTimeOfFrame } from "./recording-frame-source";

describe("recording frame timing", () => {
  it("rounds the playhead to the nearest recorded frame, inside the recording", () => {
    expect(recordingFrameAt(0.5, 60, 240)).toBe(30);
    expect(recordingFrameAt(-1, 60, 240)).toBe(0);
    expect(recordingFrameAt(10, 60, 240)).toBe(239);
  });

  it("seeks to the middle of a frame, so the decoder can't round to its neighbour", () => {
    const time = videoTimeOfFrame(30, 60);
    expect(Math.floor(time * 60)).toBe(30);
    expect(time * 60 - 30).toBeCloseTo(0.5);
  });
});
