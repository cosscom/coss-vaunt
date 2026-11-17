import { z } from "zod";

/** ffmpeg decodes to mono at this rate before bucketing; plenty for a drawn waveform. */
export const PEAKS_SAMPLE_RATE = 8000;
export const PEAKS_BUCKETS_PER_SECOND = 100;

export const peaksFileSchema = z.object({
  bucketsPerSecond: z.number().positive(),
  /** Alternating min, max per bucket, each in −1..1. */
  peaks: z.array(z.number().min(-1).max(1)),
});

export type WaveformPeaks = z.infer<typeof peaksFileSchema>;

export function peaksFilePath(file: string): string {
  return `${file}.peaks.json`;
}

const round = (value: number) => Math.round(Math.min(1, Math.max(-1, value)) * 1000) / 1000;

/** Min and max of each bucket of `samples`, rounded to 3 decimals so the JSON stays small. */
export function computePeaks(
  samples: Float32Array,
  sampleRate: number,
  bucketsPerSecond: number = PEAKS_BUCKETS_PER_SECOND
): WaveformPeaks {
  const perBucket = sampleRate / bucketsPerSecond;
  const buckets = Math.ceil(samples.length / perBucket);
  const peaks: number[] = new Array(buckets * 2);
  for (let bucket = 0; bucket < buckets; bucket++) {
    const from = Math.floor(bucket * perBucket);
    const to = Math.min(samples.length, Math.floor((bucket + 1) * perBucket));
    let min = 0;
    let max = 0;
    for (let index = from; index < to; index++) {
      const sample = samples[index] ?? 0;
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }
    peaks[bucket * 2] = round(min);
    peaks[bucket * 2 + 1] = round(max);
  }
  return { bucketsPerSecond, peaks };
}

export function parsePeaksFile(json: unknown): WaveformPeaks | null {
  const parsed = peaksFileSchema.safeParse(json);
  return parsed.success && parsed.data.peaks.length % 2 === 0 ? parsed.data : null;
}

/**
 * One min/max pair per drawn column, covering `columns × secondsPerColumn` seconds of the file from
 * `fromSeconds`. Columns wider than a bucket take the extremes of every bucket they span.
 */
export function waveformColumns(
  { bucketsPerSecond, peaks }: WaveformPeaks,
  fromSeconds: number,
  secondsPerColumn: number,
  columns: number
): Float32Array {
  const result = new Float32Array(Math.max(0, columns) * 2);
  const bucketCount = peaks.length / 2;
  for (let column = 0; column < columns; column++) {
    const start = (fromSeconds + column * secondsPerColumn) * bucketsPerSecond;
    const first = Math.max(0, Math.floor(start));
    const last = Math.min(
      bucketCount - 1,
      Math.max(first, Math.ceil(start + secondsPerColumn * bucketsPerSecond) - 1)
    );
    let min = 0;
    let max = 0;
    for (let bucket = first; bucket <= last; bucket++) {
      min = Math.min(min, peaks[bucket * 2] ?? 0);
      max = Math.max(max, peaks[bucket * 2 + 1] ?? 0);
    }
    result[column * 2] = min;
    result[column * 2 + 1] = max;
  }
  return result;
}
