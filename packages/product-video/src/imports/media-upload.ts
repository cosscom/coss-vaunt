import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import path from "node:path";
import {
  type Clip,
  clipSchema,
  DEFAULT_IMAGE_CLIP_SECONDS,
  MAX_CLIP_SECONDS,
} from "../storyboard/storyboard-schema";
import { type MediaProbe, probeMedia } from "./media-probe";
import { extensionOf, type MediaKind, maxUploadBytes, mediaTypeOf } from "./media-types";
import { runCommand } from "./run-command";

const CONVERT_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_STEM_LENGTH = 80;

/** `remux` rewraps a playable stream as MP4; `transcode` re-encodes to H.264. */
export type VideoConversion = "none" | "remux" | "transcode";

const IMAGE_CODECS = new Set(["png", "mjpeg", "webp", "gif"]);
const PLAYABLE_VIDEO_CODECS = new Set(["h264", "vp8", "vp9", "av1"]);
const PLAYABLE_PIXEL_FORMATS = new Set(["yuv420p", "yuvj420p"]);

export class MediaUploadError extends Error {
  readonly code: "unsupported-type" | "too-large" | "empty" | "unreadable" | "convert-failed";

  constructor(code: MediaUploadError["code"], message: string) {
    super(message);
    this.name = "MediaUploadError";
    this.code = code;
  }
}

/** A filesystem-safe `<stem><extension>`: ASCII letters, digits, `.`, `_` and `-`, never hidden or empty. */
export function sanitizeMediaFileName(name: string, extension: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const stem = base
    .slice(0, base.length - extensionOf(base).length)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, MAX_STEM_LENGTH);
  return `${stem || "media"}${extension}`;
}

/** Browsers play unrotated H.264 (8-bit 4:2:0), VP8, VP9 and AV1; a playable QuickTime file only needs an MP4 wrapper. */
export function planVideoConversion(probe: MediaProbe, extension: string): VideoConversion {
  const playable =
    PLAYABLE_VIDEO_CODECS.has(probe.videoCodec) &&
    (probe.videoCodec !== "h264" || PLAYABLE_PIXEL_FORMATS.has(probe.pixelFormat ?? ""));
  // WebGL uploads of a video frame ignore its rotation, so ffmpeg bakes it in.
  if (!playable || probe.rotated) return "transcode";
  return extension === ".mov" ? "remux" : "none";
}

/** Whether ffprobe agrees the bytes are what the name and MIME type claimed. */
type VisualMediaKind = Exclude<MediaKind, "audio">;

export function probeMatchesKind(probe: MediaProbe, kind: VisualMediaKind): boolean {
  if (kind === "image") return IMAGE_CODECS.has(probe.videoCodec);
  return (
    probe.duration !== null && !IMAGE_CODECS.has(probe.videoCodec) && !probe.formatName.endsWith("_pipe")
  );
}

export function clipFromMedia({
  id,
  name,
  file,
  kind,
  probe,
}: {
  id: string;
  name: string;
  /** Path relative to the project folder. */
  file: string;
  kind: VisualMediaKind;
  probe: MediaProbe;
}): Clip {
  const { width, height } = probe;
  const displayName = name.trim().slice(0, 80).trim() || (kind === "image" ? "Image" : "Video");
  const base = { id, name: displayName, start: 0, transitionIn: "cut", properties: {} } as const;
  if (kind === "image") {
    return clipSchema.parse({
      ...base,
      duration: DEFAULT_IMAGE_CLIP_SECONDS,
      source: { kind: "image", file, width, height },
    });
  }
  const fileDuration = probe.duration ?? 0;
  return clipSchema.parse({
    ...base,
    duration: Math.min(fileDuration, MAX_CLIP_SECONDS),
    source: { kind: "import", file, trimStart: 0, fileDuration, width, height },
  });
}

export async function writeCapped(
  body: ReadableStream<Uint8Array>,
  target: string,
  maxBytes: number
): Promise<number> {
  const handle = await open(target, "wx");
  const reader = body.getReader();
  let written = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      written += value.byteLength;
      if (written > maxBytes) {
        await reader.cancel();
        throw new MediaUploadError("too-large", `The file is over the ${formatBytes(maxBytes)} limit`);
      }
      await handle.write(value);
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
  return written;
}

export function formatBytes(bytes: number): string {
  return bytes >= 1024 ** 3 ? `${bytes / 1024 ** 3} GB` : `${bytes / 1024 ** 2} MB`;
}

function conversionArgs(
  conversion: Exclude<VideoConversion, "none">,
  input: string,
  output: string
): string[] {
  const video =
    conversion === "remux"
      ? ["-c:v", "copy"]
      : [
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "18",
          "-pix_fmt",
          "yuv420p",
          "-vf",
          "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        ];
  return [
    "-v",
    "error",
    "-y",
    "-i",
    input,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    ...video,
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    output,
  ];
}

/**
 * Streams an uploaded video or image into the project's `imports/` (through a hidden partial file, so a
 * failed upload leaves nothing behind), checks it with ffprobe, converts video browsers can't play to
 * H.264 MP4 with the system ffmpeg, and returns a clip of it at time 0.
 */
export async function importUploadedMedia({
  projectDir,
  name,
  mime,
  body,
  declaredBytes,
  signal,
}: {
  projectDir: string;
  name: string;
  mime: string;
  body: ReadableStream<Uint8Array>;
  /** The request's Content-Length, to refuse an oversized file before reading it. */
  declaredBytes?: number;
  signal?: AbortSignal;
}): Promise<{ clip: Clip; conversion: VideoConversion }> {
  const type = mediaTypeOf(name, mime);
  if (!type || type.kind === "audio") {
    throw new MediaUploadError(
      "unsupported-type",
      "Upload an MP4, MOV or WebM video, or a PNG, JPEG, WebP or GIF image"
    );
  }
  const maxBytes = maxUploadBytes(type.kind);
  if (declaredBytes !== undefined && declaredBytes > maxBytes) {
    throw new MediaUploadError("too-large", `The file is over the ${formatBytes(maxBytes)} limit`);
  }

  const importsDir = path.join(projectDir, "imports");
  await mkdir(importsDir, { recursive: true });
  const id = randomUUID();
  const partial = path.join(importsDir, `.upload-${id}${type.extension}`);
  const converted = path.join(importsDir, `.upload-${id}.converted.mp4`);
  try {
    const written = await writeCapped(body, partial, maxBytes);
    if (written === 0) throw new MediaUploadError("empty", "The file is empty");

    const unreadable = new MediaUploadError("unreadable", `This doesn’t look like a readable ${type.kind}`);
    let probe = await probeMedia(partial, signal).catch(() => null);
    if (!probe || !probeMatchesKind(probe, type.kind)) throw unreadable;

    let source = partial;
    let extension = type.extension;
    const conversion = type.kind === "video" ? planVideoConversion(probe, extension) : "none";
    if (conversion !== "none") {
      await runCommand("ffmpeg", conversionArgs(conversion, partial, converted), {
        timeout: CONVERT_TIMEOUT_MS,
        signal,
      }).catch((error: unknown) => {
        throw new MediaUploadError(
          "convert-failed",
          `Couldn’t convert the video to MP4: ${error instanceof Error ? error.message : "ffmpeg failed"}`
        );
      });
      probe = await probeMedia(converted, signal).catch(() => null);
      if (!probe?.duration) throw unreadable;
      source = converted;
      extension = ".mp4";
    }

    const relative = `imports/${id}-${sanitizeMediaFileName(name, extension)}`;
    const clip = clipFromMedia({ id: randomUUID(), name, file: relative, kind: type.kind, probe });
    await rename(source, path.join(projectDir, relative));
    return { clip, conversion };
  } finally {
    await Promise.all([rm(partial, { force: true }), rm(converted, { force: true })]);
  }
}
