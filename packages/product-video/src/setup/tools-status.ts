import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { type FfmpegStatus, ffmpegStatus } from "./ffmpeg-probe";

/** What the studio's first-run setup shows: whether the tools vaunt records and exports with are ready. */
export type ToolsStatus = {
  /** Playwright's Chromium, which the recorder, exporter and AI explorer drive. */
  chromium: { ready: boolean };
  ffmpeg: FfmpegStatus;
};

function chromiumReady(): boolean {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

export async function toolsStatus(): Promise<ToolsStatus> {
  return { chromium: { ready: chromiumReady() }, ffmpeg: await ffmpegStatus() };
}
