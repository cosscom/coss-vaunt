export const MAX_VIDEO_BYTES = 2 * 1024 ** 3;
export const MAX_IMAGE_BYTES = 50 * 1024 ** 2;
export const MAX_AUDIO_BYTES = 200 * 1024 ** 2;

export type MediaKind = "video" | "image" | "audio";
export type MediaType = { kind: MediaKind; extension: string };

/** SVG is left out on purpose: it can carry script. */
const EXTENSIONS: Record<string, MediaType & { mimes: string[] }> = {
  ".mp4": { kind: "video", extension: ".mp4", mimes: ["video/mp4"] },
  ".mov": { kind: "video", extension: ".mov", mimes: ["video/quicktime"] },
  ".webm": { kind: "video", extension: ".webm", mimes: ["video/webm"] },
  ".png": { kind: "image", extension: ".png", mimes: ["image/png"] },
  ".jpg": { kind: "image", extension: ".jpg", mimes: ["image/jpeg"] },
  ".jpeg": { kind: "image", extension: ".jpg", mimes: ["image/jpeg"] },
  ".webp": { kind: "image", extension: ".webp", mimes: ["image/webp"] },
  ".gif": { kind: "image", extension: ".gif", mimes: ["image/gif"] },
  ".mp3": { kind: "audio", extension: ".mp3", mimes: ["audio/mpeg", "audio/mp3"] },
  ".m4a": { kind: "audio", extension: ".m4a", mimes: ["audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac"] },
  ".aac": { kind: "audio", extension: ".aac", mimes: ["audio/aac", "audio/x-aac"] },
  ".wav": {
    kind: "audio",
    extension: ".wav",
    mimes: ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"],
  },
  ".ogg": { kind: "audio", extension: ".ogg", mimes: ["audio/ogg", "application/ogg"] },
  ".oga": { kind: "audio", extension: ".ogg", mimes: ["audio/ogg"] },
  ".flac": { kind: "audio", extension: ".flac", mimes: ["audio/flac", "audio/x-flac"] },
};
const GENERIC_MIMES = new Set(["", "application/octet-stream"]);

function acceptFor(kinds: readonly MediaKind[]): string {
  return [
    ...new Set(
      Object.entries(EXTENSIONS)
        .filter(([, type]) => kinds.includes(type.kind))
        .flatMap(([extension, type]) => [extension, ...type.mimes])
    ),
  ].join(",");
}

/** For a file input's `accept`: video and images, which become video-track clips. */
export const ACCEPTED_MEDIA = acceptFor(["video", "image"]);
export const ACCEPTED_AUDIO = acceptFor(["audio"]);

/** `.png` for `Shot.PNG`; empty without a dot. */
export function extensionOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot).toLowerCase() : "";
}

/** The accepted type of an upload from its name and the browser's MIME type; null when either rules it out. */
export function mediaTypeOf(name: string, mime: string): MediaType | null {
  const normalizedMime = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  const byExtension = EXTENSIONS[extensionOf(name)];
  if (byExtension) {
    if (!GENERIC_MIMES.has(normalizedMime) && !byExtension.mimes.includes(normalizedMime)) return null;
    return { kind: byExtension.kind, extension: byExtension.extension };
  }
  const byMime = Object.values(EXTENSIONS).find((type) => type.mimes.includes(normalizedMime));
  return byMime ? { kind: byMime.kind, extension: byMime.extension } : null;
}

const MAX_BYTES: Record<MediaKind, number> = {
  video: MAX_VIDEO_BYTES,
  image: MAX_IMAGE_BYTES,
  audio: MAX_AUDIO_BYTES,
};

export function maxUploadBytes(kind: MediaKind): number {
  return MAX_BYTES[kind];
}
