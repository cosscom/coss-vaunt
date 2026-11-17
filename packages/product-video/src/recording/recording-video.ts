import { execFile } from "node:child_process";
import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { RECORDING_MANIFEST_FILE, RECORDING_VIDEO_FILE, type RecordingManifest } from "./recording-manifest";

const runFile = promisify(execFile);
const FFMPEG = "/usr/bin/ffmpeg";
/** A keyframe every 15 frames keeps a seek to any frame a short decode. */
export const VIDEO_KEYFRAME_INTERVAL = 15;
const VIDEO_CRF = 18;

type RecordingVideo = NonNullable<RecordingManifest["video"]>;

/**
 * ffmpeg arguments for the playback video: the lossless frames at their own rate, one output frame per input
 * frame, scaled to the viewport, tagged sRGB/BT.709 so the browser shows the colours the PNGs have.
 */
export function recordingVideoArgs({
  framesPattern,
  output,
  fps,
  width,
  height,
}: {
  framesPattern: string;
  output: string;
  fps: number;
  width: number;
  height: number;
}): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-framerate",
    String(fps),
    "-start_number",
    "0",
    "-i",
    framesPattern,
    "-vf",
    `scale=${width}:${height}:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p`,
    "-fps_mode",
    "passthrough",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    String(VIDEO_CRF),
    "-g",
    String(VIDEO_KEYFRAME_INTERVAL),
    "-keyint_min",
    String(VIDEO_KEYFRAME_INTERVAL),
    "-sc_threshold",
    "0",
    "-colorspace",
    "bt709",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "iec61966-2-1",
    "-color_range",
    "tv",
    "-movflags",
    "+faststart",
    "-an",
    "-f",
    "mp4",
    output,
  ];
}

/** Even dimensions, which 4:2:0 needs. */
export function videoSize(viewport: { width: number; height: number }): { width: number; height: number } {
  return { width: viewport.width - (viewport.width % 2), height: viewport.height - (viewport.height % 2) };
}

/** Encodes `<dir>/proxy.mp4` from `<dir>/frames/`; null without ffmpeg. */
export async function writeRecordingVideo({
  dir,
  fps,
  viewport,
}: {
  dir: string;
  fps: number;
  viewport: { width: number; height: number };
}): Promise<RecordingVideo | null> {
  const ffmpegExists = await stat(FFMPEG).then(
    () => true,
    () => false
  );
  if (!ffmpegExists) return null;
  const size = videoSize(viewport);
  const partial = path.join(dir, `${RECORDING_VIDEO_FILE}.partial-${process.pid}`);
  try {
    await runFile(
      FFMPEG,
      recordingVideoArgs({
        framesPattern: path.join(dir, "frames", "%06d.png"),
        output: partial,
        fps,
        ...size,
      })
    );
    await rename(partial, path.join(dir, RECORDING_VIDEO_FILE));
  } finally {
    await rm(partial, { force: true });
  }
  return { file: RECORDING_VIDEO_FILE, ...size };
}

const pending = new Map<string, Promise<RecordingManifest | null>>();

/**
 * Gives an existing recording its playback video if it has none, and returns its manifest; null when there's no
 * recording in `dir`. Concurrent calls for one recording share the work.
 */
export function ensureRecordingVideo(dir: string): Promise<RecordingManifest | null> {
  const running = pending.get(dir);
  if (running) return running;
  const work = (async () => {
    const manifestPath = path.join(dir, RECORDING_MANIFEST_FILE);
    const manifest = await readFile(manifestPath, "utf8")
      .then((text) => JSON.parse(text) as RecordingManifest)
      .catch(() => null);
    if (!manifest) return null;
    const hasVideo =
      manifest.video &&
      (await stat(path.join(dir, manifest.video.file)).then(
        () => true,
        () => false
      ));
    if (hasVideo) return manifest;
    const video = await writeRecordingVideo({ dir, fps: manifest.fps, viewport: manifest.viewport });
    if (!video) return manifest;
    const next: RecordingManifest = { ...manifest, video };
    const partial = `${manifestPath}.partial-${process.pid}`;
    await writeFile(partial, `${JSON.stringify(next, null, 2)}\n`);
    await rename(partial, manifestPath);
    return next;
  })().finally(() => pending.delete(dir));
  pending.set(dir, work);
  return work;
}
