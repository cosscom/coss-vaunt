import { describe, expect, it } from "vitest";
import { nextRecordingViewState, recordingPercent, recordingStarted } from "./recording-view-state";

describe("nextRecordingViewState", () => {
  it("reads a status event as recorded or not", () => {
    const checking = { kind: "checking" } as const;
    expect(
      nextRecordingViewState(checking, { type: "status", captureHash: "abc", recorded: { frameCount: 180 } })
    ).toEqual({ kind: "recorded", captureHash: "abc", frameCount: 180 });
    expect(nextRecordingViewState(checking, { type: "status", captureHash: "abc", recorded: null })).toEqual({
      kind: "idle",
      captureHash: "abc",
    });
  });

  it("follows phases and frames, then lands on done", () => {
    let state = nextRecordingViewState(recordingStarted(), { type: "phase", phase: "preroll" });
    expect(state).toMatchObject({ kind: "recording", phase: "preroll", frameCount: null });
    state = nextRecordingViewState(state, {
      type: "frame",
      frame: 45,
      frameCount: 180,
      elapsedSeconds: 13,
      etaSeconds: 40,
    });
    expect(recordingPercent(state)).toBe(25);
    state = nextRecordingViewState(state, { type: "phase", phase: "proxy" });
    expect(state).toMatchObject({ phase: "proxy", frame: 45, frameCount: 180 });
    expect(recordingPercent(state)).toBe(100);
    state = nextRecordingViewState(state, {
      type: "done",
      captureHash: "abc",
      frameCount: 180,
      directory: "/x",
      reused: false,
      secondsPerFrame: 0.3,
    });
    expect(state).toEqual({ kind: "recorded", captureHash: "abc", frameCount: 180 });
  });

  it("shows the recorder's error", () => {
    expect(
      nextRecordingViewState(recordingStarted(), { type: "error", message: "Refusing to record" })
    ).toEqual({
      kind: "failed",
      message: "Refusing to record",
    });
  });

  it("has no percent before frames are counted", () => {
    expect(recordingPercent(recordingStarted())).toBeNull();
    expect(recordingPercent({ kind: "checking" })).toBeNull();
  });
});
