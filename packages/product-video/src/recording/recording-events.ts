export type RecordingPhase = "login" | "load" | "preroll" | "replay" | "reply" | "capture" | "proxy";

export type RecordingProgress =
  | { type: "phase"; phase: RecordingPhase }
  | { type: "frame"; frame: number; frameCount: number; elapsedSeconds: number; etaSeconds: number };

/** What the record CLI prints with `--json`, one per line, and the studio streams to the editor. */
export type RecordingEvent =
  | RecordingProgress
  | {
      type: "done";
      captureHash: string;
      frameCount: number;
      directory: string;
      reused: boolean;
      secondsPerFrame: number | null;
    }
  | { type: "error"; message: string };

/** Sent instead of a job's events when nothing is recording: whether the clip's current capture is on disk. */
export type RecordingStatusEvent = {
  type: "status";
  captureHash: string;
  recorded: { frameCount: number } | null;
};

export type RecordingStreamEvent = RecordingEvent | RecordingStatusEvent;

export function parseRecordingEvent(line: string): RecordingEvent | null {
  try {
    const value: unknown = JSON.parse(line);
    if (value && typeof value === "object" && "type" in value && typeof value.type === "string") {
      return value as RecordingEvent;
    }
  } catch {
    return null;
  }
  return null;
}
