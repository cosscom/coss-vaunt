import type { AudioTrack } from "../storyboard/storyboard-schema";

/** Music dips this far while a sound effect plays, ramping over the attack and back over the release. */
export const DUCKING = { depthDb: -8, attackSeconds: 0.08, releaseSeconds: 0.25 } as const;

export type DuckingOptions = { depthDb: number; attackSeconds: number; releaseSeconds: number };
type Interval = readonly [start: number, end: number];

/** When sound effects on unmuted tracks play, merged into non-overlapping project-time intervals. */
export function sfxIntervals(tracks: readonly AudioTrack[]): Interval[] {
  const spans = tracks
    .filter((track) => !track.muted)
    .flatMap((track) => track.clips)
    .filter((clip) => clip.kind === "sfx" && (clip.volume.value > 0 || clip.volume.keyframes.length > 0))
    .map((clip): Interval => [clip.start, clip.start + clip.duration])
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [start, end] of spans) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/** Gain for music at project `time`: 1, or eased linearly toward the ducked level around each interval. */
export function duckingGainAt(
  intervals: readonly Interval[],
  time: number,
  { depthDb, attackSeconds, releaseSeconds }: DuckingOptions = DUCKING
): number {
  const floor = 10 ** (depthDb / 20);
  const range = 1 - floor;
  const attack = (from: number, elapsed: number) =>
    Math.max(floor, from - (attackSeconds > 0 ? (range * elapsed) / attackSeconds : range));
  const release = (from: number, elapsed: number) =>
    Math.min(1, from + (releaseSeconds > 0 ? (range * elapsed) / releaseSeconds : range));

  let releasedFrom: { level: number; at: number } | null = null;
  for (const [start, end] of intervals) {
    if (time < start) return releasedFrom ? release(releasedFrom.level, time - releasedFrom.at) : 1;
    const startLevel: number = releasedFrom ? release(releasedFrom.level, start - releasedFrom.at) : 1;
    if (time <= end) return attack(startLevel, time - start);
    releasedFrom = { level: attack(startLevel, end - start), at: end };
  }
  return releasedFrom ? release(releasedFrom.level, time - releasedFrom.at) : 1;
}
