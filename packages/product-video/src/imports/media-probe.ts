import { runCommand } from "./run-command";

const PROBE_TIMEOUT_MS = 30 * 1000;

export type MediaProbe = {
  /** ffprobe's container names, e.g. `mov,mp4,m4a,3gp,3g2,mj2` or `png_pipe`. */
  formatName: string;
  /** Null for still images. */
  duration: number | null;
  /** Display size, with a ±90° rotation already applied. */
  width: number;
  height: number;
  videoCodec: string;
  pixelFormat: string | null;
  hasAudio: boolean;
  /** Carries a display rotation that players must apply. */
  rotated: boolean;
};

type FfprobeOutput = {
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    pix_fmt?: string;
    tags?: { rotate?: string };
    side_data_list?: Array<{ rotation?: number }>;
  }>;
  format?: { format_name?: string; duration?: string };
};

/** Reads the first video stream (an image counts as one) and whether there is audio, with the system ffprobe. */
export async function probeMedia(file: string, signal?: AbortSignal): Promise<MediaProbe | null> {
  const output = await runCommand(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,codec_name,width,height,pix_fmt:stream_tags=rotate:stream_side_data=rotation:format=format_name,duration",
      "-of",
      "json",
      "--",
      file,
    ],
    { timeout: PROBE_TIMEOUT_MS, signal }
  );
  const parsed = JSON.parse(output) as FfprobeOutput;
  const video = parsed.streams?.find((stream) => stream.codec_type === "video");
  if (!video?.width || !video.height || !video.codec_name) return null;
  const rotation =
    video.side_data_list?.find((data) => typeof data.rotation === "number")?.rotation ??
    Number.parseFloat(video.tags?.rotate ?? "0");
  const quarterTurn = Math.abs(Math.round(rotation / 90)) % 2 === 1;
  const duration = Number.parseFloat(parsed.format?.duration ?? "");
  return {
    formatName: parsed.format?.format_name ?? "",
    duration: Number.isFinite(duration) && duration > 0 ? duration : null,
    width: quarterTurn ? video.height : video.width,
    height: quarterTurn ? video.width : video.height,
    videoCodec: video.codec_name,
    pixelFormat: video.pix_fmt ?? null,
    hasAudio: parsed.streams?.some((stream) => stream.codec_type === "audio") ?? false,
    rotated: Math.round(rotation) % 360 !== 0,
  };
}
