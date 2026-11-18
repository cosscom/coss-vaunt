import { z } from "zod";
import { OUTPUT_SIZES } from "../recording/capture-dpr";
import type { AspectRatio, Project } from "../storyboard/storyboard-schema";

export const EXPORT_PRESETS = ["web", "social", "lossless"] as const;
export type ExportPreset = (typeof EXPORT_PRESETS)[number];

export const EXPORT_RESOLUTIONS = ["720p", "1080p", "1440p", "2160p"] as const;
export type ExportResolution = (typeof EXPORT_RESOLUTIONS)[number];

export const EXPORT_FRAME_RATES = [24, 25, 30, 60] as const;

export type ExportFormat = "mp4" | "prores";

/** Everything an export needs beyond the project: what to encode and how hard. */
export type ExportSettings = {
  format: ExportFormat;
  resolution: ExportResolution;
  fps: number;
  /** H.264 only; ProRes picks its own. */
  videoBitrateMbps: number;
  audio: boolean;
};

export const MIN_VIDEO_BITRATE_MBPS = 1;
export const MAX_VIDEO_BITRATE_MBPS = 80;

/** What the studio accepts from the export dialog. */
export const exportSettingsSchema = z.object({
  format: z.enum(["mp4", "prores"]),
  resolution: z.enum(EXPORT_RESOLUTIONS),
  fps: z.number().int().min(1).max(60),
  videoBitrateMbps: z.number().min(0).max(MAX_VIDEO_BITRATE_MBPS),
  audio: z.boolean(),
});

/** Output size relative to the 1080p frame for the aspect ratio (1920 × 1080 at 16:9, 1080 × 1920 at 9:16). */
const RESOLUTION_SCALE: Record<ExportResolution, number> = {
  "720p": 2 / 3,
  "1080p": 1,
  "1440p": 4 / 3,
  "2160p": 2,
};

const AUDIO_BITRATE_KBPS = 192;
/** ProRes 4444 at 1080p30 runs about 330 Mbps; scaled by pixels and frame rate for the size estimate. */
const PRORES_4444_MBPS_1080P30 = 330;
const PCM_KBPS = 48 * 16 * 2;

/**
 * Web: small and quick to load, streams from the first byte. Social: the headroom the networks re-encode
 * from without visible loss. Lossless: a ProRes 4444 master for editing tools.
 */
export function presetSettings(preset: ExportPreset, projectFps: number): ExportSettings {
  switch (preset) {
    case "web":
      return { format: "mp4", resolution: "1080p", fps: projectFps, videoBitrateMbps: 8, audio: true };
    case "social":
      return { format: "mp4", resolution: "1080p", fps: projectFps, videoBitrateMbps: 20, audio: true };
    case "lossless":
      return { format: "prores", resolution: "1080p", fps: projectFps, videoBitrateMbps: 0, audio: true };
  }
}

/** The preset these settings are, or null once any of them has been changed by hand. */
export function matchingPreset(settings: ExportSettings, projectFps: number): ExportPreset | null {
  return (
    EXPORT_PRESETS.find((preset) => {
      const candidate = presetSettings(preset, projectFps);
      return (
        candidate.format === settings.format &&
        candidate.resolution === settings.resolution &&
        candidate.fps === settings.fps &&
        candidate.audio === settings.audio &&
        (settings.format === "prores" || candidate.videoBitrateMbps === settings.videoBitrateMbps)
      );
    }) ?? null
  );
}

/** Pixel size of the output; even on both sides, as H.264 at 4:2:0 needs. */
export function exportSize(
  aspectRatio: AspectRatio,
  resolution: ExportResolution
): { width: number; height: number } {
  const base = OUTPUT_SIZES[aspectRatio];
  const scale = RESOLUTION_SCALE[resolution];
  const even = (value: number) => Math.round((value * scale) / 2) * 2;
  return { width: even(base.width), height: even(base.height) };
}

export function exportExtension(format: ExportFormat): "mp4" | "mov" {
  return format === "mp4" ? "mp4" : "mov";
}

/** Roughly how big the file will be, in bytes. */
export function estimatedBytes(
  settings: ExportSettings,
  size: { width: number; height: number },
  seconds: number
): number {
  const videoMbps =
    settings.format === "mp4"
      ? settings.videoBitrateMbps
      : PRORES_4444_MBPS_1080P30 * ((size.width * size.height) / (1920 * 1080)) * (settings.fps / 30);
  const audioKbps = settings.audio ? (settings.format === "mp4" ? AUDIO_BITRATE_KBPS : PCM_KBPS) : 0;
  return ((videoMbps * 1_000_000 + audioKbps * 1000) / 8) * seconds;
}

/**
 * ffmpeg arguments that read PNG frames from stdin (and the mixed audio from `audioFile` when given) and
 * write `output`. H.264 is constrained to the bitrate so platforms see a predictable stream.
 */
export function ffmpegExportArgs({
  settings,
  audioFile,
  output,
}: {
  settings: ExportSettings;
  audioFile: string | null;
  output: string;
}): string[] {
  const input = ["-f", "image2pipe", "-framerate", String(settings.fps), "-c:v", "png", "-i", "-"];
  const audioInput = audioFile ? ["-i", audioFile] : [];
  const video =
    settings.format === "mp4"
      ? [
          "-c:v",
          "libx264",
          "-preset",
          "slow",
          "-profile:v",
          "high",
          "-pix_fmt",
          "yuv420p",
          "-b:v",
          `${settings.videoBitrateMbps}M`,
          "-maxrate",
          `${Math.round(settings.videoBitrateMbps * 1.5)}M`,
          "-bufsize",
          `${settings.videoBitrateMbps * 2}M`,
          "-colorspace",
          "bt709",
          "-color_primaries",
          "bt709",
          "-color_trc",
          "bt709",
        ]
      : ["-c:v", "prores_ks", "-profile:v", "4", "-pix_fmt", "yuv444p10le", "-vendor", "apl0"];
  const audio = audioFile
    ? settings.format === "mp4"
      ? ["-c:a", "aac", "-b:a", `${AUDIO_BITRATE_KBPS}k`]
      : ["-c:a", "pcm_s16le"]
    : [];
  const container = settings.format === "mp4" ? ["-movflags", "+faststart"] : [];
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    ...input,
    ...audioInput,
    "-map",
    "0:v",
    ...(audioFile ? ["-map", "1:a", "-shortest"] : []),
    ...video,
    ...audio,
    ...container,
    output,
  ];
}

/** A file name for the export: the project's name, made safe, with the settings that tell copies apart. */
export function exportFileName(
  project: Pick<Project, "name" | "settings">,
  settings: ExportSettings,
  at: Date
): string {
  const base =
    project.name
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, 60) || "export";
  const stamp = at.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const ratio = project.settings.aspectRatio.replace(":", "x");
  return `${base}-${ratio}-${settings.resolution}-${stamp}.${exportExtension(settings.format)}`;
}
