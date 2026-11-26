import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { computePeaks, PEAKS_SAMPLE_RATE, peaksFilePath } from "../audio/waveform-peaks";
import { vauntTool } from "../setup/vaunt-bin";
import { type AudioClip, audioClipSchema } from "../storyboard/storyboard-schema";
import { type AudioProbe, probeAudio } from "./audio-probe";
import { maxUploadBytes, mediaTypeOf } from "./media-types";
import { formatBytes, MediaUploadError, sanitizeMediaFileName, writeCapped } from "./media-upload";
import { runCommand } from "./run-command";

const CONVERT_TIMEOUT_MS = 10 * 60 * 1000;
/** Longer clips are a music bed; shorter ones a sound effect that music ducks under. */
export const MUSIC_MIN_SECONDS = 15;

/** `transcode` re-encodes to AAC in an M4A, which every browser decodes. */
export type AudioConversion = "none" | "transcode";

const KEPT_CODECS: Record<string, (codec: string) => boolean> = {
  ".mp3": (codec) => codec === "mp3",
  ".wav": (codec) => codec.startsWith("pcm_"),
  ".m4a": (codec) => codec === "aac",
};

/** MP3, PCM WAV and AAC M4A decode everywhere; Ogg, FLAC and raw AAC are re-encoded for Safari's sake. */
export function planAudioConversion(probe: AudioProbe, extension: string): AudioConversion {
  return KEPT_CODECS[extension]?.(probe.codec) ? "none" : "transcode";
}

export function audioClipFromProbe({
  id,
  name,
  file,
  probe,
}: {
  id: string;
  name: string;
  file: string;
  probe: AudioProbe;
}): AudioClip {
  return audioClipSchema.parse({
    id,
    name: name.trim().slice(0, 80).trim() || "Audio",
    file,
    kind: probe.duration > MUSIC_MIN_SECONDS ? "music" : "sfx",
    start: 0,
    duration: probe.duration,
    trimStart: 0,
    fileDuration: probe.duration,
    volume: { value: 1, keyframes: [] },
    fadeIn: 0,
    fadeOut: 0,
  });
}

const transcodeArgs = (input: string, output: string) => [
  "-v",
  "error",
  "-y",
  "-i",
  input,
  "-map",
  "0:a:0",
  "-vn",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-movflags",
  "+faststart",
  output,
];

/** Mono 32-bit float PCM at the peaks rate, written raw so it can be read back as a Float32Array. */
const pcmArgs = (input: string, output: string) => [
  "-v",
  "error",
  "-y",
  "-i",
  input,
  "-map",
  "0:a:0",
  "-ac",
  "1",
  "-ar",
  String(PEAKS_SAMPLE_RATE),
  "-f",
  "f32le",
  output,
];

async function ffmpeg(args: string[], signal: AbortSignal | undefined, failure: string): Promise<void> {
  await runCommand(vauntTool("ffmpeg"), args, { timeout: CONVERT_TIMEOUT_MS, signal }).catch(
    (error: unknown) => {
      throw new MediaUploadError(
        "convert-failed",
        `${failure}: ${error instanceof Error ? error.message : "ffmpeg failed"}`
      );
    }
  );
}

/**
 * Streams an uploaded audio file into the project's `imports/`, checks it with ffprobe, re-encodes what
 * browsers can't all decode, and writes its waveform peaks to `<file>.peaks.json` beside it.
 */
export async function importUploadedAudio({
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
  declaredBytes?: number;
  signal?: AbortSignal;
}): Promise<{ audioClip: AudioClip; conversion: AudioConversion }> {
  const type = mediaTypeOf(name, mime);
  if (type?.kind !== "audio") {
    throw new MediaUploadError("unsupported-type", "Upload an MP3, M4A, WAV, Ogg or FLAC audio file");
  }
  const maxBytes = maxUploadBytes("audio");
  if (declaredBytes !== undefined && declaredBytes > maxBytes) {
    throw new MediaUploadError("too-large", `The file is over the ${formatBytes(maxBytes)} limit`);
  }

  const importsDir = path.join(projectDir, "imports");
  await mkdir(importsDir, { recursive: true });
  const id = randomUUID();
  const partial = path.join(importsDir, `.upload-${id}${type.extension}`);
  const converted = path.join(importsDir, `.upload-${id}.converted.m4a`);
  const pcm = path.join(importsDir, `.upload-${id}.pcm`);
  try {
    const written = await writeCapped(body, partial, maxBytes);
    if (written === 0) throw new MediaUploadError("empty", "The file is empty");

    const unreadable = new MediaUploadError("unreadable", "This doesn’t look like a readable audio file");
    let probe = await probeAudio(partial, signal).catch(() => null);
    if (!probe) throw unreadable;

    let source = partial;
    let extension = type.extension;
    const conversion = planAudioConversion(probe, extension);
    if (conversion === "transcode") {
      await ffmpeg(transcodeArgs(partial, converted), signal, "Couldn’t convert the audio to M4A");
      probe = await probeAudio(converted, signal).catch(() => null);
      if (!probe) throw unreadable;
      source = converted;
      extension = ".m4a";
    }

    await ffmpeg(pcmArgs(source, pcm), signal, "Couldn’t read the waveform");
    // Copied out of the Buffer, whose offset into a shared pool needn't be 4-byte aligned.
    const bytes = new Uint8Array(await readFile(pcm));
    const samples = new Float32Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 4));
    const peaks = computePeaks(samples, PEAKS_SAMPLE_RATE);

    const relative = `imports/${id}-${sanitizeMediaFileName(name, extension)}`;
    const audioClip = audioClipFromProbe({ id: randomUUID(), name, file: relative, probe });
    await writeFile(path.join(projectDir, peaksFilePath(relative)), JSON.stringify(peaks));
    await rename(source, path.join(projectDir, relative));
    return { audioClip, conversion };
  } finally {
    await Promise.all([partial, converted, pcm].map((file) => rm(file, { force: true })));
  }
}
