import { describe, expect, it } from "vitest";
import type { AudioClip, AudioTrack } from "../storyboard/storyboard-schema";
import { DUCKING, duckingGainAt, sfxIntervals } from "./audio-ducking";

const audio = (id: string, kind: AudioClip["kind"], start: number, duration: number): AudioClip => ({
  id,
  name: id,
  file: `imports/${id}.wav`,
  kind,
  start,
  duration,
  trimStart: 0,
  fileDuration: 60,
  volume: { value: 1, keyframes: [] },
  fadeIn: 0,
  fadeOut: 0,
});

const track = (clips: AudioClip[], muted?: boolean): AudioTrack => ({ id: "t", name: "Audio", clips, muted });
const floor = 10 ** (DUCKING.depthDb / 20);

describe("sfxIntervals", () => {
  it("merges overlapping sfx and ignores music and muted tracks", () => {
    const tracks = [
      track([audio("bed", "music", 0, 20), audio("a", "sfx", 1, 1), audio("b", "sfx", 1.5, 1)]),
      track([audio("c", "sfx", 5, 0.3)], true),
      track([audio("d", "sfx", 4, 0.5)]),
    ];
    expect(sfxIntervals(tracks)).toEqual([
      [1, 2.5],
      [4, 4.5],
    ]);
  });

  it("skips a silent sfx", () => {
    const silent = { ...audio("a", "sfx", 1, 1), volume: { value: 0, keyframes: [] } };
    expect(sfxIntervals([track([silent])])).toEqual([]);
  });
});

describe("duckingGainAt", () => {
  const intervals = [[1, 2]] as const;

  it("is −8 dB under an sfx after an 80 ms attack and back to 1 after a 250 ms release", () => {
    expect(duckingGainAt(intervals, 0.5)).toBe(1);
    expect(duckingGainAt(intervals, 1.04)).toBeCloseTo(1 - (1 - floor) / 2);
    expect(duckingGainAt(intervals, 1.5)).toBeCloseTo(floor);
    expect(floor).toBeCloseTo(0.398, 3);
    expect(duckingGainAt(intervals, 2.125)).toBeCloseTo(floor + (1 - floor) / 2);
    expect(duckingGainAt(intervals, 2.3)).toBe(1);
  });

  it("starts a short sfx's release from the level its attack reached", () => {
    const reached = 1 - (1 - floor) / 2;
    expect(duckingGainAt([[1, 1.04]], 1.04)).toBeCloseTo(reached);
    expect(duckingGainAt([[1, 1.04]], 1.04 + 0.0625)).toBeCloseTo(reached + (1 - floor) / 4);
  });

  it("carries a partial release into the next attack", () => {
    const midRelease = duckingGainAt([[1, 2]], 2.125);
    expect(
      duckingGainAt(
        [
          [1, 2],
          [2.125, 3],
        ],
        2.125
      )
    ).toBeCloseTo(midRelease);
    expect(
      duckingGainAt(
        [
          [1, 2],
          [2.125, 3],
        ],
        2.165
      )
    ).toBeCloseTo(floor);
  });
});
