import { describe, expect, it } from "vitest";
import type { AudioClip, AudioTrack } from "../storyboard/storyboard-schema";
import { audioSegmentsBetween, contextTimeAt, projectTimeAt, voiceTiming } from "./audio-schedule";

const audio = (id: string, start: number, duration: number, trimStart = 0): AudioClip => ({
  id,
  name: id,
  file: `imports/${id}.mp3`,
  kind: "music",
  start,
  duration,
  trimStart,
  fileDuration: 60,
  volume: { value: 1, keyframes: [] },
  fadeIn: 0,
  fadeOut: 0,
});

const tracks: AudioTrack[] = [
  { id: "t1", name: "Music", clips: [audio("bed", 0, 20, 3)] },
  { id: "t2", name: "Sfx", clips: [audio("click", 4, 0.3), audio("late", 9, 1)] },
  { id: "t3", name: "Muted", clips: [audio("muted", 0, 5)], muted: true },
];

const summary = (from: number, until: number, scheduled?: Set<string>) =>
  audioSegmentsBetween(tracks, from, until, scheduled).map(({ clip, at, offset, duration }) => ({
    id: clip.id,
    at,
    offset,
    duration,
  }));

describe("audioSegmentsBetween", () => {
  it("starts a clip under way at `from` mid-file, after its trim", () => {
    expect(summary(2.5, 3)).toEqual([{ id: "bed", at: 2.5, offset: 5.5, duration: 17.5 }]);
  });

  it("includes clips starting inside the window at their own start, in time order", () => {
    expect(summary(3, 5).map(({ id, at, offset }) => [id, at, offset])).toEqual([
      ["bed", 3, 6],
      ["click", 4, 0],
    ]);
  });

  it("skips clips already scheduled, finished, not yet due or on muted tracks", () => {
    expect(summary(4.3, 8, new Set(["bed"]))).toEqual([]);
    expect(summary(8, 9)).toEqual([{ id: "bed", at: 8, offset: 11, duration: 12 }]);
  });
});

describe("contextTimeAt", () => {
  it("offsets project time by the anchor", () => {
    expect(contextTimeAt({ context: 100, project: 2 }, 4.5)).toBe(102.5);
    expect(projectTimeAt({ context: 100, project: 2 }, 102.5)).toBe(4.5);
  });
});

describe("voiceTiming", () => {
  const [bed] = audioSegmentsBetween(tracks, 2.5, 3);
  const anchor = { context: 10, project: 2.5 };

  it("starts a segment on time at its offset into the file", () => {
    expect(bed && voiceTiming(bed, anchor, 10, 23)).toEqual({
      when: 10,
      offset: 5.5,
      duration: 17.5,
      fromLocal: 2.5,
    });
  });

  it("starts a late segment now, further into the file, so it stays in sync", () => {
    const timing = bed && voiceTiming(bed, anchor, 10.2, 23);
    expect(timing?.when).toBeCloseTo(10.2);
    expect(timing?.offset).toBeCloseTo(5.7);
    expect(timing?.duration).toBeCloseTo(17.3);
    expect(timing?.fromLocal).toBeCloseTo(2.7);
  });

  it("stops at the end of a shorter decoded buffer, and skips a segment with nothing left", () => {
    expect(bed && voiceTiming(bed, anchor, 10, 10)?.duration).toBeCloseTo(4.5);
    expect(bed && voiceTiming(bed, anchor, 30, 23)).toBeNull();
  });
});
