import type { ExportSettings } from "./export-settings";

/** What the export CLI prints with `--json`, one per line, and the studio streams to the export dialog. */
export type ExportEvent =
  | { type: "phase"; phase: "load" | "audio" | "frames" | "encode" }
  | { type: "frame"; frame: number; frameCount: number; elapsedSeconds: number; etaSeconds: number }
  | { type: "done"; file: string; bytes: number; seconds: number }
  | { type: "error"; message: string };

/** The request the studio starts an export with. */
export type ExportRequest = { settings: ExportSettings; name: string };

export function parseExportEvent(line: string): ExportEvent | null {
  try {
    const value: unknown = JSON.parse(line);
    if (value && typeof value === "object" && "type" in value && typeof value.type === "string") {
      return value as ExportEvent;
    }
  } catch {
    return null;
  }
  return null;
}
