import { randomUUID } from "node:crypto";
import { access, mkdir, readdir, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { type Clip, clipSchema } from "../storyboard/storyboard-schema";
import { probeMedia } from "./media-probe";
import { runCommand } from "./run-command";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const FORMAT = "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/b";
const DEFAULT_CLIP_SECONDS = 8;
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const PROBE_TIMEOUT_MS = 30 * 1000;

export type YoutubeImportProgress =
  | { stage: "downloading"; percent: number | null }
  | { stage: "probing" }
  | { stage: "cached" };

export class YoutubeImportError extends Error {
  readonly code: "invalid-id" | "missing-binary" | "download-failed" | "probe-failed";

  constructor(code: YoutubeImportError["code"], message: string) {
    super(message);
    this.name = "YoutubeImportError";
    this.code = code;
  }
}

/** Accepts a bare video id or any youtube.com / youtu.be URL that carries one. */
export function parseYoutubeVideoId(input: string): string | null {
  const value = input.trim();
  if (VIDEO_ID_PATTERN.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let candidate: string | null | undefined = null;
  if (host === "youtu.be") candidate = url.pathname.split("/")[1];
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    candidate = url.searchParams.get("v") ?? /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(url.pathname)?.[1];
  }
  return candidate && VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
}

/** The percentage on a yt-dlp `[download]  42.1% of …` progress line. */
export function parseDownloadPercent(line: string): number | null {
  const match = /^\[download\]\s+([\d.]+)%/.exec(line.trim());
  return match ? Number.parseFloat(match[1] ?? "") : null;
}

export function youtubeImportFile(videoId: string): string {
  return `imports/youtube-${videoId}.mp4`;
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false
  );
}

/** `yt-dlp` on PATH, else the user-local install (`next dev` often runs without ~/.local/bin on PATH). */
async function resolveYtDlp(): Promise<string> {
  for (const candidate of ["yt-dlp", path.join(homedir(), ".local/bin/yt-dlp")]) {
    const works = await runCommand(candidate, ["--version"], { timeout: PROBE_TIMEOUT_MS }).then(
      () => true,
      () => false
    );
    if (works) return candidate;
  }
  throw new YoutubeImportError(
    "missing-binary",
    "yt-dlp isn’t installed (looked on PATH and in ~/.local/bin)"
  );
}

async function probe(
  file: string,
  signal?: AbortSignal
): Promise<{ duration: number; width: number; height: number }> {
  const probed = await probeMedia(file, signal).catch((error: unknown) => {
    throw new YoutubeImportError("probe-failed", error instanceof Error ? error.message : "ffprobe failed");
  });
  if (!probed?.duration) {
    throw new YoutubeImportError("probe-failed", "The downloaded file has no readable video stream");
  }
  return { duration: probed.duration, width: probed.width, height: probed.height };
}

/**
 * Downloads a YouTube video (≤ 1080p MP4) into the project's `imports/` with the system `yt-dlp`, unless
 * it is already there, and returns an import clip of it at time 0. Dev-only test footage.
 */
export async function importYoutubeVideo({
  projectDir,
  videoId,
  onProgress,
  signal,
}: {
  projectDir: string;
  videoId: string;
  onProgress?: (progress: YoutubeImportProgress) => void;
  signal?: AbortSignal;
}): Promise<Clip> {
  if (!VIDEO_ID_PATTERN.test(videoId)) throw new YoutubeImportError("invalid-id", "Not a YouTube video id");
  const relative = youtubeImportFile(videoId);
  const target = path.join(projectDir, relative);

  if (await exists(target)) {
    onProgress?.({ stage: "cached" });
  } else {
    const binary = await resolveYtDlp();
    await mkdir(path.dirname(target), { recursive: true });
    const partialPrefix = `.youtube-${videoId}.${randomUUID()}`;
    const partial = path.join(path.dirname(target), `${partialPrefix}.mp4`);
    onProgress?.({ stage: "downloading", percent: null });
    try {
      await runCommand(
        binary,
        [
          "--no-playlist",
          "--newline",
          "--no-warnings",
          "-f",
          FORMAT,
          "--merge-output-format",
          "mp4",
          "-o",
          partial,
          "--",
          videoId,
        ],
        {
          timeout: DOWNLOAD_TIMEOUT_MS,
          signal,
          onLine: (line) => {
            const percent = parseDownloadPercent(line);
            if (percent !== null) onProgress?.({ stage: "downloading", percent });
          },
        }
      );
      await rename(partial, target);
    } catch (error) {
      // yt-dlp leaves per-format files (`<name>.f137.mp4`) beside the output when a merge fails.
      const leftovers = (await readdir(path.dirname(target))).filter((name) =>
        name.startsWith(partialPrefix)
      );
      await Promise.all(leftovers.map((name) => rm(path.join(path.dirname(target), name), { force: true })));
      throw new YoutubeImportError(
        "download-failed",
        error instanceof Error ? error.message : "yt-dlp failed"
      );
    }
  }

  onProgress?.({ stage: "probing" });
  const { duration, width, height } = await probe(target, signal);
  return clipSchema.parse({
    id: randomUUID(),
    name: `YouTube ${videoId}`,
    start: 0,
    duration: Math.min(DEFAULT_CLIP_SECONDS, duration),
    transitionIn: "cut",
    properties: {},
    source: { kind: "import", file: relative, trimStart: 0, fileDuration: duration, width, height },
  });
}
