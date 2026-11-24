import type { RecordingPhase, RecordingStreamEvent } from "@coss/vaunt-engine/recording/recording-events";

export type RecordingViewState =
  | { kind: "checking" }
  | { kind: "idle"; captureHash: string | null }
  | { kind: "recorded"; captureHash: string; frameCount: number }
  | {
      kind: "recording";
      phase: RecordingPhase;
      frame: number;
      frameCount: number | null;
      etaSeconds: number | null;
    }
  | { kind: "failed"; message: string };

type Recording = Extract<RecordingViewState, { kind: "recording" }>;

const startedRecording: Recording = {
  kind: "recording",
  phase: "load",
  frame: 0,
  frameCount: null,
  etaSeconds: null,
};

export function recordingStarted(): RecordingViewState {
  return startedRecording;
}

/** The record button's state after one event from the record route's stream. */
export function nextRecordingViewState(
  state: RecordingViewState,
  event: RecordingStreamEvent
): RecordingViewState {
  const recording: Recording = state.kind === "recording" ? state : startedRecording;
  switch (event.type) {
    case "status":
      return event.recorded
        ? { kind: "recorded", captureHash: event.captureHash, frameCount: event.recorded.frameCount }
        : { kind: "idle", captureHash: event.captureHash };
    case "phase":
      return { ...recording, phase: event.phase };
    case "frame":
      return {
        kind: "recording",
        phase: "capture",
        frame: event.frame,
        frameCount: event.frameCount,
        etaSeconds: event.etaSeconds,
      };
    case "done":
      return { kind: "recorded", captureHash: event.captureHash, frameCount: event.frameCount };
    case "error":
      return { kind: "failed", message: event.message };
  }
}

/** Percent done for the progress bar, or null while the length is unknown. */
export function recordingPercent(state: RecordingViewState): number | null {
  if (state.kind !== "recording" || !state.frameCount) return null;
  if (state.phase === "proxy") return 100;
  return Math.round((state.frame / state.frameCount) * 100);
}
