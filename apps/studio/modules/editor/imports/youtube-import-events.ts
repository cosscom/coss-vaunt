import type { YoutubeImportProgress } from "@coss/vaunt-engine/imports/youtube-import";
import type { Clip } from "@coss/vaunt-engine/storyboard/storyboard-schema";

export type YoutubeImportEvent =
  | { type: "progress"; progress: YoutubeImportProgress }
  | { type: "done"; clip: Clip }
  | { type: "error"; message: string };

/** Splits a newline-delimited JSON stream into events; returns them with the unfinished tail. */
export function readImportEvents(buffered: string): { events: YoutubeImportEvent[]; rest: string } {
  const lines = buffered.split("\n");
  const rest = lines.pop() ?? "";
  const events = lines.filter((line) => line.trim()).map((line) => JSON.parse(line) as YoutubeImportEvent);
  return { events, rest };
}
