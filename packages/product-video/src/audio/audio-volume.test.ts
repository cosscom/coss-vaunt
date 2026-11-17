import { describe, expect, it } from "vitest";
import type { AudioClip } from "../storyboard/storyboard-schema";
import { audioClipGainAt, audioGainCurve, fadeGain } from "./audio-volume";

const clip = (overrides: Partial<AudioClip> = {}): AudioClip => ({
  id: "a1",
  name: "bed",
  file: "imports/bed.mp3",
  kind: "music",
  start: 2,
  duration: 10,
  trimStart: 0,
  fileDuration: 20,
  volume: { value: 0.5, keyframes: [] },
  fadeIn: 2,
  fadeOut: 4,
  ...overrides,
});

describe("fadeGain", () => {
  it("ramps in and out linearly and is flat between", () => {
    const span = clip();
    expect(fadeGain(span, 0)).toBe(0);
    expect(fadeGain(span, 1)).toBeCloseTo(0.5);
    expect(fadeGain(span, 5)).toBe(1);
    expect(fadeGain(span, 8)).toBeCloseTo(0.5);
    expect(fadeGain(span, 10)).toBe(0);
  });

  it("is 1 throughout without fades", () => {
    expect(fadeGain(clip({ fadeIn: 0, fadeOut: 0 }), 0)).toBe(1);
    expect(fadeGain(clip({ fadeIn: 0, fadeOut: 0 }), 10)).toBe(1);
  });
});

describe("audioClipGainAt", () => {
  it("multiplies keyframed volume by the fades", () => {
    const volume = {
      value: 1,
      keyframes: [
        { id: "k1", at: 0, value: 0, ease: "linear" as const },
        { id: "k2", at: 4, value: 1, ease: "linear" as const },
      ],
    };
    const animated = clip({ volume, fadeIn: 0, fadeOut: 4 });
    expect(audioClipGainAt(animated, 2)).toBeCloseTo(0.5);
    expect(audioClipGainAt(animated, 7)).toBeCloseTo(0.75);
    expect(audioClipGainAt(clip(), 1)).toBeCloseTo(0.25);
  });
});

describe("audioGainCurve", () => {
  it("samples both ends of the span and applies ducking in project time", () => {
    const curve = audioGainCurve({
      clip: clip({ fadeIn: 0, fadeOut: 0 }),
      fromLocal: 1,
      duration: 2,
      samplesPerSecond: 2,
      duck: (time) => (time >= 4 ? 0.5 : 1),
    });
    expect(Array.from(curve)).toEqual([0.5, 0.5, 0.25, 0.25, 0.25]);
  });

  it("always has at least two samples", () => {
    expect(
      audioGainCurve({ clip: clip(), fromLocal: 5, duration: 0.001, samplesPerSecond: 10 })
    ).toHaveLength(2);
  });
});
