import type { RecordingPhase } from "@calcom/product-video/recording/recording-events";

export const RECORDING_COPY = {
  record: "Record clip",
  rerecord: "Re-record",
  checking: "Checking recording…",
  notRecorded: "Not recorded for this version of the clip.",
  recorded: (frames: number) => `Recorded · ${frames} frames`,
  frame: (frame: number, total: number) => `Frame ${frame} of ${total}`,
  eta: (seconds: number) =>
    seconds < 60 ? `about ${Math.ceil(seconds)} s left` : `about ${Math.ceil(seconds / 60)} min left`,
  phases: {
    login: "Signing in…",
    load: "Loading the page…",
    preroll: "Letting the page settle…",
    replay: "Replaying the previous clip…",
    capture: "Recording…",
    proxy: "Making preview frames…",
  } satisfies Record<RecordingPhase, string>,
  doneToast: (frames: number) => `Recorded ${frames} frames`,
  failedToast: "Recording failed",
  failed: "The recording failed.",
} as const;
