import { vauntTool } from "../setup/vaunt-bin";
import { runCommand } from "./run-command";

const PROBE_TIMEOUT_MS = 30 * 1000;

export type AudioProbe = {
  formatName: string;
  duration: number;
  codec: string;
  sampleRate: number;
  channels: number;
};

type FfprobeOutput = {
  streams?: Array<{ codec_type?: string; codec_name?: string; sample_rate?: string; channels?: number }>;
  format?: { format_name?: string; duration?: string };
};

/** Parses ffprobe's JSON for the first audio stream; null without one or without a duration. */
export function parseAudioProbe(output: string): AudioProbe | null {
  const parsed = JSON.parse(output) as FfprobeOutput;
  const stream = parsed.streams?.find((candidate) => candidate.codec_type === "audio");
  const duration = Number.parseFloat(parsed.format?.duration ?? "");
  const sampleRate = Number.parseInt(stream?.sample_rate ?? "", 10);
  if (!stream?.codec_name || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(sampleRate)) {
    return null;
  }
  return {
    formatName: parsed.format?.format_name ?? "",
    duration,
    codec: stream.codec_name,
    sampleRate,
    channels: stream.channels ?? 1,
  };
}

/** Reads the first audio stream's codec, sample rate and channels, and the file's duration, with the system ffprobe. */
export async function probeAudio(file: string, signal?: AbortSignal): Promise<AudioProbe | null> {
  const output = await runCommand(
    vauntTool("ffprobe"),
    [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,codec_name,sample_rate,channels:format=format_name,duration",
      "-of",
      "json",
      "--",
      file,
    ],
    { timeout: PROBE_TIMEOUT_MS, signal }
  );
  return parseAudioProbe(output);
}
