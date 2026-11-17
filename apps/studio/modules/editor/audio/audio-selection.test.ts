import { createProject } from "@calcom/product-video/storyboard/storyboard-factories";
import type { AudioClip, Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { describe, expect, it } from "vitest";
import { createPlaybackClock } from "../player/playback-clock";
import {
  audioSelectionFor,
  EMPTY_AUDIO_SELECTION,
  pruneAudioSelection,
  selectAudioClip,
  selectVolumeKeyframes,
} from "./audio-selection";

const audio = (id: string, keyframeIds: string[] = []): AudioClip => ({
  id,
  name: id,
  file: `imports/${id}.mp3`,
  kind: "music",
  start: 0,
  duration: 5,
  trimStart: 0,
  fileDuration: 5,
  volume: {
    value: 1,
    keyframes: keyframeIds.map((k, index) => ({ id: k, at: index, value: 1, ease: "linear" })),
  },
  fadeIn: 0,
  fadeOut: 0,
});

const project = (clips: AudioClip[]): Project => ({
  ...createProject({ name: "p", now: new Date("2026-11-17T00:00:00Z") }),
  audioTracks: [{ id: "t", name: "Audio", clips }],
});

describe("selectAudioClip", () => {
  it("replaces on a plain click and toggles when additive", () => {
    const one = selectAudioClip(EMPTY_AUDIO_SELECTION, "a", false);
    expect(selectAudioClip(one, "b", true).clipIds).toEqual(["a", "b"]);
    expect(selectAudioClip({ clipIds: ["a", "b"], keyframeIds: [] }, "a", true).clipIds).toEqual(["b"]);
    expect(selectAudioClip(one, "b", false)).toEqual({ clipIds: ["b"], keyframeIds: [] });
  });

  it("drops keyframes when the primary clip changes", () => {
    const selection = { clipIds: ["a"], keyframeIds: ["k1"] };
    expect(selectAudioClip(selection, "b", true).keyframeIds).toEqual([]);
  });
});

describe("selectVolumeKeyframes", () => {
  it("makes the keyframe's clip primary and toggles additively within it", () => {
    const selected = selectVolumeKeyframes({ clipIds: ["a", "b"], keyframeIds: [] }, "a", ["k1"], false);
    expect(selected).toEqual({ clipIds: ["b", "a"], keyframeIds: ["k1"] });
    expect(selectVolumeKeyframes(selected, "a", ["k2"], true).keyframeIds).toEqual(["k1", "k2"]);
    expect(selectVolumeKeyframes(selected, "a", ["k1"], true).keyframeIds).toEqual([]);
  });
});

describe("pruneAudioSelection", () => {
  it("keeps the same object when nothing is gone, and drops missing ids", () => {
    const selection = { clipIds: ["a"], keyframeIds: ["k1"] };
    expect(pruneAudioSelection(selection, project([audio("a", ["k1"])]))).toBe(selection);
    expect(pruneAudioSelection(selection, project([audio("a")]))).toEqual({
      clipIds: ["a"],
      keyframeIds: [],
    });
    expect(pruneAudioSelection(selection, project([]))).toEqual(EMPTY_AUDIO_SELECTION);
  });
});

describe("audioSelectionFor", () => {
  it("shares one store per clock and notifies on change", () => {
    const clock = createPlaybackClock(() => 0);
    const store = audioSelectionFor(clock);
    expect(audioSelectionFor(clock)).toBe(store);
    let calls = 0;
    store.subscribe(() => calls++);
    store.set({ clipIds: ["a"], keyframeIds: [] });
    store.set(store.get());
    expect(calls).toBe(1);
  });
});
