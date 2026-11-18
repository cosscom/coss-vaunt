import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import type { Project } from "../storyboard/storyboard-schema";
import type { ExportEvent } from "./export-events";
import { type ExportSettings, exportSize, ffmpegExportArgs } from "./export-settings";

/** The render page exposes this; see `apps/studio/modules/render/render-view.tsx`. */
type RenderApi = {
  duration: number;
  renderFrame: (time: number) => Promise<void>;
  renderAudio: () => Promise<string | null>;
};

const PAGE_TIMEOUT_MS = 120_000;

/**
 * Steps the studio's render page through every frame in a headless browser, pipes lossless screenshots into
 * ffmpeg with the offline audio mix, and writes `exports/<name>` in the project folder. The file appears only
 * once ffmpeg has finished, so a cancelled or failed export leaves nothing half-written.
 */
export async function exportVideo({
  project,
  projectDir,
  studioUrl,
  settings,
  name,
  onEvent,
  signal,
}: {
  project: Project;
  projectDir: string;
  /** Where the studio is served, e.g. `http://localhost:3102`. */
  studioUrl: string;
  settings: ExportSettings;
  name: string;
  onEvent: (event: ExportEvent) => void;
  signal?: AbortSignal;
}): Promise<{ file: string; bytes: number; seconds: number }> {
  const started = Date.now();
  const size = exportSize(project.settings.aspectRatio, settings.resolution);
  const exportsDir = path.join(projectDir, "exports");
  await mkdir(exportsDir, { recursive: true });
  const output = path.join(exportsDir, name);
  const partial = path.join(exportsDir, `.partial-${name}`);
  const audioFile = path.join(exportsDir, `.audio-${name}.wav`);

  onEvent({ type: "phase", phase: "load" });
  const browser = await chromium.launch({
    args: ["--force-color-profile=srgb", "--hide-scrollbars", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    const url = `${studioUrl}/render/${encodeURIComponent(project.id)}?width=${size.width}&height=${size.height}`;
    await page.goto(url, { timeout: PAGE_TIMEOUT_MS });
    await page.waitForFunction(() => "__studioRender" in window, null, { timeout: PAGE_TIMEOUT_MS });
    const duration = await page.evaluate(
      () => (window as unknown as { __studioRender: RenderApi }).__studioRender.duration
    );
    if (!(duration > 0)) throw new Error("The project has nothing on its timeline to export");

    let withAudio = false;
    if (settings.audio) {
      onEvent({ type: "phase", phase: "audio" });
      const wav = await page.evaluate(() =>
        (window as unknown as { __studioRender: RenderApi }).__studioRender.renderAudio()
      );
      if (wav) {
        await writeFile(audioFile, Buffer.from(wav, "base64"));
        withAudio = true;
      }
    }

    // Written to a hidden name with the real extension's muxer, then renamed once complete.
    const args = ffmpegExportArgs({ settings, audioFile: withAudio ? audioFile : null, output: partial });
    args.splice(args.length - 1, 0, "-f", settings.format === "mp4" ? "mp4" : "mov");
    const ffmpeg = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
    let ffmpegError = "";
    ffmpeg.stderr.on("data", (chunk: Buffer) => {
      ffmpegError = (ffmpegError + chunk.toString()).slice(-2000);
    });
    const finished = once(ffmpeg, "close");
    ffmpeg.stdin.on("error", () => undefined);
    const abort = () => ffmpeg.kill("SIGKILL");
    signal?.addEventListener("abort", abort, { once: true });

    onEvent({ type: "phase", phase: "frames" });
    const frameCount = Math.max(1, Math.round(duration * settings.fps));
    const framesStarted = Date.now();
    for (let frame = 0; frame < frameCount; frame++) {
      if (signal?.aborted) throw new Error("Export cancelled");
      await page.evaluate(
        (time) => (window as unknown as { __studioRender: RenderApi }).__studioRender.renderFrame(time),
        frame / settings.fps
      );
      const png = await page.screenshot({ type: "png", animations: "disabled", caret: "hide" });
      if (!ffmpeg.stdin.write(png)) await once(ffmpeg.stdin, "drain");
      const elapsedSeconds = (Date.now() - framesStarted) / 1000;
      onEvent({
        type: "frame",
        frame: frame + 1,
        frameCount,
        elapsedSeconds,
        etaSeconds: (elapsedSeconds / (frame + 1)) * (frameCount - frame - 1),
      });
    }

    onEvent({ type: "phase", phase: "encode" });
    ffmpeg.stdin.end();
    const [code] = (await finished) as [number | null];
    signal?.removeEventListener("abort", abort);
    if (code !== 0) throw new Error(`ffmpeg failed${ffmpegError ? `: ${ffmpegError.trim()}` : ""}`);
    await rename(partial, output);
    const { size: bytes } = await stat(output);
    return { file: path.relative(projectDir, output), bytes, seconds: (Date.now() - started) / 1000 };
  } finally {
    await browser.close().catch(() => undefined);
    await Promise.all([rm(partial, { force: true }), rm(audioFile, { force: true })]);
  }
}
