import { describe, expect, it } from "vitest";
import { type AudioClip, audioClipSchema, audioTrackSchema } from "./storyboard-schema";

const clip = (overrides: Partial<AudioClip> = {}): AudioClip => ({
  id: "a1",
  name: "bed.mp3",
  file: "imports/x-bed.mp3",
  kind: "music",
  start: 0,
  duration: 10,
  trimStart: 0,
  fileDuration: 20,
  volume: { value: 0.8, keyframes: [] },
  fadeIn: 0,
  fadeOut: 0,
  ...overrides,
});

const issuePath = (value: unknown) => audioClipSchema.safeParse(value).error?.issues[0]?.path;

describe("audio clips", () => {
  it("accepts an animated volume and fades", () => {
    const volume = {
      value: 1,
      keyframes: [
        { id: "k1", at: 0, value: 0.2, ease: "linear" as const },
        { id: "k2", at: 4, value: 1, ease: "ease-in-out" as const },
      ],
    };
    expect(audioClipSchema.safeParse(clip({ volume, fadeIn: 2, fadeOut: 5 })).success).toBe(true);
  });

  it("rejects a plain-number volume from the old schema", () => {
    expect(audioClipSchema.safeParse({ ...clip(), volume: 0.5 }).success).toBe(false);
  });

  it("keeps volume values in 0..1", () => {
    expect(issuePath(clip({ volume: { value: 1.2, keyframes: [] } }))).toEqual(["volume", "value"]);
    const keyframes = [{ id: "k1", at: 1, value: -0.1, ease: "linear" as const }];
    expect(issuePath(clip({ volume: { value: 1, keyframes } }))).toEqual(["volume", "keyframes.0"]);
  });

  it("rejects a volume keyframe after the clip ends", () => {
    const keyframes = [{ id: "k1", at: 11, value: 1, ease: "linear" as const }];
    expect(issuePath(clip({ volume: { value: 1, keyframes } }))).toEqual(["volume", "keyframes", 0, "at"]);
  });

  it("bounds the clip by its file", () => {
    expect(issuePath(clip({ trimStart: 12 }))).toEqual(["duration"]);
    expect(audioClipSchema.safeParse(clip({ trimStart: 10 })).success).toBe(true);
  });

  it("caps each fade at 5 s and both together at the clip length", () => {
    expect(issuePath(clip({ fadeIn: 5.5 }))).toEqual(["fadeIn"]);
    expect(issuePath(clip({ duration: 3, fadeIn: 2, fadeOut: 2 }))).toEqual(["fadeOut"]);
  });

  it("keeps the music/sfx kind", () => {
    expect(audioClipSchema.safeParse(clip({ kind: "sfx" })).success).toBe(true);
    expect(audioClipSchema.safeParse({ ...clip(), kind: "voice" }).success).toBe(false);
  });
});

describe("audio tracks", () => {
  it("accepts an optional muted flag", () => {
    expect(audioTrackSchema.safeParse({ id: "t1", name: "Audio", clips: [] }).success).toBe(true);
    expect(audioTrackSchema.parse({ id: "t1", name: "Audio", clips: [clip()], muted: true }).muted).toBe(
      true
    );
  });
});
