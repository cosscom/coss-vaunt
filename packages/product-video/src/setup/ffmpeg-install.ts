import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { type FfmpegDownload, ffmpegDownloadFor } from "./ffmpeg-downloads";
import { inspectFfmpeg, missingEncoders } from "./ffmpeg-probe";
import { executableName, vauntBinDir } from "./vaunt-bin";
import { findZipEntry, readZipEntry, zipEntries } from "./zip-extract";

const runFile = promisify(execFile);
const PROGRESS_INTERVAL_MS = 100;
const TOOLS = ["ffmpeg", "ffprobe"] as const;

export type FfmpegInstallEvent =
  | { type: "progress"; received: number; total: number | null }
  | { type: "extracting" }
  | { type: "verifying" }
  | { type: "done"; version: string | null; path: string }
  | { type: "error"; message: string };

/** A failure whose message is written for the person installing. */
export class FfmpegInstallError extends Error {}

/** How to install ffmpeg without vaunt, for messages. */
export function ffmpegInstallHint(platform: NodeJS.Platform = process.platform): string {
  if (platform === "darwin") return "brew install ffmpeg";
  if (platform === "win32") return 'winget install "FFmpeg (Essentials Build)"';
  return "your package manager, e.g. sudo apt install ffmpeg";
}

/** Whether a file's SHA-256 (hex) is the expected one. */
export function checksumMatches(actual: string, expected: string): boolean {
  return actual.trim().toLowerCase() === expected.trim().toLowerCase();
}

function writeError(error: unknown, dir: string): FfmpegInstallError {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOSPC")
    return new FfmpegInstallError("There isn't enough free disk space to install ffmpeg.");
  if (code === "EACCES" || code === "EPERM" || code === "EROFS")
    return new FfmpegInstallError(`vaunt can't write to ${dir}. Check its permissions, then try again.`);
  return new FfmpegInstallError(`Couldn't save ffmpeg to ${dir}: ${(error as Error).message}`);
}

function aborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new FfmpegInstallError("The install was cancelled.");
}

/** Streams `url` to `file`, hashing as it goes; returns the SHA-256. */
async function download(
  url: string,
  file: string,
  { signal, onBytes }: { signal?: AbortSignal; onBytes: (count: number) => void }
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, { signal, redirect: "follow" });
  } catch {
    aborted(signal);
    throw new FfmpegInstallError(
      "Couldn't reach the download server. Check your connection, then try again."
    );
  }
  if (!response.ok || !response.body)
    throw new FfmpegInstallError(
      `The download server answered ${response.status}${response.statusText ? ` ${response.statusText}` : ""}. Try again later, or install ffmpeg with ${ffmpegInstallHint()}.`
    );

  const hash = createHash("sha256");
  const out = createWriteStream(file);
  const outDone = new Promise<void>((resolve, reject) => {
    out.on("finish", resolve);
    out.on("error", reject);
  });
  outDone.catch(() => undefined);
  const reader = response.body.getReader();
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        aborted(signal);
        throw new FfmpegInstallError("The download was interrupted. Check your connection, then try again.");
      }
      if (chunk.done) break;
      hash.update(chunk.value);
      onBytes(chunk.value.byteLength);
      if (!out.write(chunk.value)) await new Promise<void>((resolve) => out.once("drain", resolve));
    }
    out.end();
    await outDone.catch((error: unknown) => {
      throw writeError(error, path.dirname(file));
    });
  } finally {
    out.destroy();
    reader.cancel().catch(() => undefined);
  }
  return hash.digest("hex");
}

/** On macOS: drop the quarantine flag and make sure the binary has at least an ad-hoc signature. */
async function prepareForMac(file: string): Promise<void> {
  await runFile("xattr", ["-d", "com.apple.quarantine", file]).catch(() => undefined);
  const signed = await runFile("codesign", ["-dv", file]).then(
    () => true,
    () => false
  );
  if (!signed) await runFile("codesign", ["-s", "-", file]).catch(() => undefined);
}

/**
 * Downloads ffmpeg and ffprobe for this machine into vaunt's bin dir, checking each archive against its pinned
 * checksum and the installed ffmpeg for the encoders vaunt needs. Throws FfmpegInstallError with a message for
 * the user; leaves nothing behind when it fails or `signal` aborts.
 */
export async function installFfmpeg({
  onEvent = () => undefined,
  signal,
  binDir = vauntBinDir(),
  source = ffmpegDownloadFor(),
}: {
  onEvent?: (event: FfmpegInstallEvent) => void;
  signal?: AbortSignal;
  binDir?: string;
  source?: FfmpegDownload | null;
} = {}): Promise<{ version: string | null; path: string }> {
  if (!source)
    throw new FfmpegInstallError(
      `vaunt doesn't have an ffmpeg download for ${process.platform} on ${process.arch}. Install it with ${ffmpegInstallHint()}.`
    );

  await mkdir(binDir, { recursive: true }).catch((error: unknown) => {
    throw writeError(error, binDir);
  });
  const work = await mkdtemp(path.join(binDir, ".ffmpeg-install-")).catch((error: unknown) => {
    throw writeError(error, binDir);
  });
  try {
    const total = source.archives.reduce((sum, archive) => sum + archive.bytes, 0) || null;
    let received = 0;
    let lastProgress = 0;
    onEvent({ type: "progress", received, total });
    const archives: string[] = [];
    for (const [index, archive] of source.archives.entries()) {
      const file = path.join(work, `download-${index}.zip`);
      const sha256 = await download(archive.url, file, {
        signal,
        onBytes: (count) => {
          received += count;
          const now = Date.now();
          if (now - lastProgress < PROGRESS_INTERVAL_MS) return;
          lastProgress = now;
          onEvent({ type: "progress", received, total: total === null ? null : Math.max(total, received) });
        },
      });
      if (!checksumMatches(sha256, archive.sha256))
        throw new FfmpegInstallError(
          "The download didn't match its checksum, so it wasn't installed. Try again."
        );
      archives.push(file);
    }
    onEvent({ type: "progress", received, total: total === null ? null : Math.max(total, received) });

    aborted(signal);
    onEvent({ type: "extracting" });
    const extracted = new Map<string, string>();
    for (const file of archives) {
      const zip = await readFile(file);
      const entries = zipEntries(zip);
      for (const tool of TOOLS) {
        const name = executableName(tool);
        const entry = !extracted.has(tool) && findZipEntry(entries, name);
        if (!entry) continue;
        const target = path.join(work, name);
        await writeFile(target, readZipEntry(zip, entry)).catch((error: unknown) => {
          throw writeError(error, binDir);
        });
        await chmod(target, 0o755);
        extracted.set(tool, target);
      }
      await rm(file, { force: true });
    }
    for (const tool of TOOLS)
      if (!extracted.has(tool))
        throw new FfmpegInstallError(`The download didn't contain ${executableName(tool)}.`);

    aborted(signal);
    onEvent({ type: "verifying" });
    if (process.platform === "darwin") for (const file of extracted.values()) await prepareForMac(file);
    const inspection = await inspectFfmpeg(extracted.get("ffmpeg") as string);
    if (!inspection) throw new FfmpegInstallError("The downloaded ffmpeg won't run on this machine.");
    const missing = missingEncoders(inspection.encoders);
    if (missing.length > 0)
      throw new FfmpegInstallError(`The downloaded ffmpeg is missing the ${missing.join(" and ")} encoder.`);
    await runFile(extracted.get("ffprobe") as string, ["-version"]).catch(() => {
      throw new FfmpegInstallError("The downloaded ffprobe won't run on this machine.");
    });

    aborted(signal);
    // ffprobe first, so a copy of ffmpeg in the bin dir always comes with its ffprobe.
    for (const tool of ["ffprobe", "ffmpeg"] as const) {
      const name = executableName(tool);
      await rename(extracted.get(tool) as string, path.join(binDir, name)).catch((error: unknown) => {
        throw writeError(error, binDir);
      });
    }
    return { version: inspection.version, path: path.join(binDir, executableName("ffmpeg")) };
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

type Job = {
  /** Every event so far except progress, which only keeps its latest, so someone joining catches up. */
  events: FfmpegInstallEvent[];
  progress: FfmpegInstallEvent | null;
  listeners: Set<(event: FfmpegInstallEvent) => void>;
  controller: AbortController;
};

/** Lives on globalThis so a dev-server module reload doesn't start a second download beside a running one. */
const registry = globalThis as { __vauntFfmpegInstall?: Job | null };

/**
 * Follows the ffmpeg install, starting it when none is running; someone joining a running install gets its events
 * so far. Returns an unsubscribe; when the last follower leaves before it finishes, the download is aborted and
 * its partial files removed.
 */
export function followFfmpegInstall(onEvent: (event: FfmpegInstallEvent) => void): () => void {
  let job = registry.__vauntFfmpegInstall ?? null;
  if (job) {
    // Progress only comes before the other events, so the latest one goes first.
    if (job.progress) onEvent(job.progress);
    for (const event of job.events) onEvent(event);
  } else {
    const started: Job = {
      events: [],
      progress: null,
      listeners: new Set(),
      controller: new AbortController(),
    };
    job = started;
    registry.__vauntFfmpegInstall = started;
    const emit = (event: FfmpegInstallEvent) => {
      if (event.type === "progress") started.progress = event;
      else started.events.push(event);
      for (const listener of started.listeners) listener(event);
    };
    installFfmpeg({ onEvent: emit, signal: started.controller.signal })
      .then(
        ({ version, path: file }) => emit({ type: "done", version, path: file }),
        (error: unknown) =>
          emit({
            type: "error",
            message:
              error instanceof FfmpegInstallError
                ? error.message
                : `Couldn't install ffmpeg: ${(error as Error).message}`,
          })
      )
      .finally(() => {
        if (registry.__vauntFfmpegInstall === started) registry.__vauntFfmpegInstall = null;
      });
  }
  const current = job;
  current.listeners.add(onEvent);
  return () => {
    current.listeners.delete(onEvent);
    if (current.listeners.size === 0) current.controller.abort();
  };
}
