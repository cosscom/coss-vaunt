import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { downloadBytes, ffmpegDownloadFor } from "./ffmpeg-downloads";
import { findOnPath, vauntBinDir, vauntToolCopy } from "./vaunt-bin";

const runFile = promisify(execFile);
const PROBE_TIMEOUT_MS = 10_000;

/** Encoders vaunt can't work without: H.264 for recording previews and export, WebP for proxies. */
export const REQUIRED_ENCODERS = ["libx264", "libwebp"] as const;

/**
 * The version from `ffmpeg -version`: "9.1" for a release (also from "n9.1" or "9.1-essentials_build-…"), the raw
 * string for a snapshot such as "N-129157-g9ced9e345c", or null when it isn't ffmpeg's output.
 */
export function parseFfmpegVersion(output: string): string | null {
  const raw = /^ffmpeg version (\S+)/m.exec(output)?.[1];
  if (!raw) return null;
  return /^n?(\d+(?:\.\d+)+)/.exec(raw)?.[1] ?? raw;
}

/** Encoder names from `ffmpeg -encoders`, whose rows look like ` V....D libx264   libx264 H.264 …`. */
export function parseEncoders(output: string): Set<string> {
  const names = new Set<string>();
  // The legend above the "------" line looks like rows too (" V..... = Video").
  const separator = /^\s*-{3,}\s*$/m.exec(output);
  const rows = separator ? output.slice(separator.index + separator[0].length) : output;
  for (const match of rows.matchAll(/^\s*[VAS][F.][S.][X.][B.][D.]\s+(\S+)/gm)) names.add(match[1]);
  return names;
}

export type FfmpegInspection = { version: string | null; encoders: Set<string> };

/** Runs the binary for its version and encoders; null when it doesn't run or isn't ffmpeg. */
export async function inspectFfmpeg(file: string): Promise<FfmpegInspection | null> {
  try {
    const [version, encoders] = await Promise.all([
      runFile(file, ["-hide_banner", "-version"], { timeout: PROBE_TIMEOUT_MS }),
      runFile(file, ["-hide_banner", "-encoders"], { timeout: PROBE_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 }),
    ]);
    // -hide_banner doesn't hide -version's first line.
    return { version: parseFfmpegVersion(version.stdout), encoders: parseEncoders(encoders.stdout) };
  } catch {
    return null;
  }
}

export function missingEncoders(encoders: Set<string>): string[] {
  return REQUIRED_ENCODERS.filter((name) => !encoders.has(name));
}

export type FfmpegStatus = {
  /** Found, and has every encoder in REQUIRED_ENCODERS. */
  ready: boolean;
  /** vaunt's own copy in its bin dir, or one already on the PATH. */
  source: "vaunt" | "system" | null;
  version: string | null;
  path: string | null;
  missingEncoders: string[];
  /** Size of vaunt's download for this machine, when there is one. */
  downloadBytes: number | null;
  /** Whether vaunt has a download for this platform and CPU. */
  installable: boolean;
};

/** Which ffmpeg vaunt would use, preferring its own copy, and whether it's good enough. */
export async function ffmpegStatus(): Promise<FfmpegStatus> {
  const download = ffmpegDownloadFor();
  const base = { downloadBytes: download ? downloadBytes(download) : null, installable: download !== null };

  const candidates: Array<{ file: string; source: "vaunt" | "system" }> = [];
  const own = vauntToolCopy("ffmpeg");
  if (own) candidates.push({ file: own, source: "vaunt" });
  const onPath = findOnPath("ffmpeg");
  // `vaunt start` puts the bin dir first on the PATH, so the PATH can find vaunt's own copy again.
  if (onPath && path.dirname(onPath) !== vauntBinDir()) candidates.push({ file: onPath, source: "system" });

  let first: FfmpegStatus | null = null;
  for (const { file, source } of candidates) {
    const inspection = await inspectFfmpeg(file);
    if (!inspection) continue;
    const missing = missingEncoders(inspection.encoders);
    const status: FfmpegStatus = {
      ready: missing.length === 0,
      source,
      version: inspection.version,
      path: file,
      missingEncoders: missing,
      ...base,
    };
    if (status.ready) return status;
    first ??= status;
  }
  return (
    first ?? {
      ready: false,
      source: null,
      version: null,
      path: null,
      missingEncoders: [...REQUIRED_ENCODERS],
      ...base,
    }
  );
}
