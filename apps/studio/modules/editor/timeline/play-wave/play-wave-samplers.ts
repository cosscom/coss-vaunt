import { type WaveformPeaks, waveformColumns } from "@coss/vaunt-engine/audio/waveform-peaks";
import type { Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { mulberry32 } from "./play-wave-config";

/** How loud (0–1) the video is around `time`, over a span of `span` seconds. */
export type PlayWaveSampler = (time: number, span: number) => number;

/** The loudest unmuted audio clip under `time`, from each file's peaks (keyed by the clip's `file`), normalised. */
export function audioSampler(
  project: Pick<Project, "audioTracks">,
  peaksByFile: ReadonlyMap<string, WaveformPeaks>
): PlayWaveSampler | null {
  const clips = project.audioTracks
    .filter((track) => !track.muted)
    .flatMap((track) => track.clips)
    .filter((clip) => peaksByFile.has(clip.file));
  if (clips.length === 0) return null;
  // Scaled to the project's loudest moment, so a quiet mix still fills the pill and a loud one doesn't clip it.
  let ceiling = 0;
  for (const clip of clips)
    for (const value of peaksByFile.get(clip.file)?.peaks ?? []) ceiling = Math.max(ceiling, Math.abs(value));
  const gain = ceiling > 0 ? 1 / ceiling : 1;
  return (time, span) => {
    let loudest = 0;
    for (const clip of clips) {
      if (time < clip.start || time >= clip.start + clip.duration) continue;
      const peaks = peaksByFile.get(clip.file);
      if (!peaks) continue;
      const columns = waveformColumns(peaks, time - clip.start + clip.trimStart, Math.max(0.01, span), 1);
      loudest = Math.max(loudest, Math.abs(columns[0] ?? 0), Math.abs(columns[1] ?? 0));
    }
    return Math.min(1, loudest * gain);
  };
}

/**
 * The cut, not the sound: each clip hums low with a little seeded texture, every cut spikes, and a transition (two
 * clips overlapping) swells for as long as it lasts. Silence between clips stays flat.
 */
export function clipsSampler(project: Pick<Project, "videoTracks">, seed: number): PlayWaveSampler | null {
  const clips = project.videoTracks.filter((track) => !track.hidden).flatMap((track) => track.clips);
  if (clips.length === 0) return null;
  const edges = clips.flatMap((clip) => [clip.start, clip.start + clip.duration]);
  const noise = seededNoise(seed);
  return (time, span) => {
    const covering = clips.filter((clip) => time >= clip.start && time < clip.start + clip.duration);
    if (covering.length === 0) return 0;
    const reach = Math.max(span * 1.5, 0.08);
    const cut = Math.max(0, ...edges.map((edge) => 1 - Math.abs(edge - time) / reach));
    const transition = covering.length > 1 ? 0.75 : 0;
    const body = 0.2 + noise(time * 3) * 0.22;
    return Math.min(1, Math.max(body, transition, cut));
  };
}

/** Seeded speech-like noise, for the lab and for projects with nothing on them yet. */
export function syntheticSampler(seed: number): PlayWaveSampler {
  const noise = seededNoise(seed);
  const words = seededNoise(seed + 101);
  return (time) => {
    const gate = words(time * 2.4) > 0.3 ? 1 : 0.12;
    return Math.min(1, (0.25 + noise(time * 18) * 0.75) * gate);
  };
}

/** Smooth 1D value noise over a seeded lattice, 0–1. */
function seededNoise(seed: number): (x: number) => number {
  const random = mulberry32(seed);
  const lattice = Array.from({ length: 512 }, () => random());
  return (x) => {
    const index = Math.floor(x);
    const fraction = x - index;
    const a = lattice[((index % 512) + 512) % 512] ?? 0;
    const b = lattice[(((index + 1) % 512) + 512) % 512] ?? 0;
    const smooth = fraction * fraction * (3 - 2 * fraction);
    return a + (b - a) * smooth;
  };
}
