import { describe, expect, it } from "vitest";
import { createProject } from "../storyboard/storyboard-factories";
import { type AudioClip, type Project, projectSchema } from "../storyboard/storyboard-schema";
import {
  addAudioTrack,
  addVolumeKeyframeAt,
  copyVolumeKeyframes,
  duplicateAudioClips,
  findAudioClip,
  moveAudioClips,
  moveVolumeKeyframes,
  pasteVolumeKeyframes,
  placeAudioClips,
  removeAudioClips,
  removeVolumeKeyframes,
  setAudioFade,
  setAudioTrimStart,
  setVolumeAt,
  setVolumeKeyframeEase,
  splitAudioClip,
  toggleVolumeKeyframeAt,
  trimAudioClip,
} from "./audio-edits";

const audio = (id: string, overrides: Partial<AudioClip> = {}): AudioClip => ({
  id,
  name: id,
  file: `imports/${id}.mp3`,
  kind: "music",
  start: 2,
  duration: 6,
  trimStart: 1,
  fileDuration: 10,
  volume: { value: 0.8, keyframes: [] },
  fadeIn: 1,
  fadeOut: 1,
  ...overrides,
});

const keyed = (at: number, value: number, id = `k${at}`) => ({ id, at, value, ease: "linear" as const });

function projectWith(...tracks: AudioClip[][]): Project {
  const base = createProject({ name: "Audio", now: new Date("2026-11-17T00:00:00Z") });
  return {
    ...base,
    audioTracks: tracks.map((clips, index) => ({ id: `t${index}`, name: `A${index}`, clips })),
  };
}

describe("placeAudioClips", () => {
  it("lays dropped clips end to end from the drop time", () => {
    const next = placeAudioClips(projectWith([]), 0, [audio("a"), audio("b")], 3);
    expect(next.audioTracks[0]?.clips.map((clip) => [clip.id, clip.start])).toEqual([
      ["a", 3],
      ["b", 9],
    ]);
    expect(projectSchema.safeParse(next).success).toBe(true);
  });

  it("adds a track to drop onto", () => {
    expect(addAudioTrack(projectWith(), "Audio").audioTracks).toHaveLength(1);
  });
});

describe("moveAudioClips", () => {
  it("moves a group without letting its earliest clip pass 0", () => {
    const project = projectWith([audio("a"), audio("b", { start: 10 })]);
    const moved = moveAudioClips(project, ["a", "b"], -5);
    expect(moved.audioTracks[0]?.clips.map((clip) => clip.start)).toEqual([0, 8]);
  });

  it("moves across tracks within bounds", () => {
    const project = projectWith([audio("a")], []);
    expect(findAudioClip(moveAudioClips(project, ["a"], 1, 1), "a")).toMatchObject({ trackIndex: 1 });
    expect(findAudioClip(moveAudioClips(project, ["a"], 1, 5), "a")).toMatchObject({ trackIndex: 1 });
  });
});

describe("trimAudioClip", () => {
  it("bounds the start edge by the file's beginning and shifts keyframes with the sound", () => {
    const clip = audio("a", { volume: { value: 1, keyframes: [keyed(0.5, 0.2), keyed(3, 1)] } });
    const extended = trimAudioClip(clip, "start", 0);
    expect(extended).toMatchObject({ start: 1, trimStart: 0, duration: 7 });
    expect(extended.volume.keyframes.map((k) => k.at)).toEqual([1.5, 4]);
    const shortened = trimAudioClip(clip, "start", 3);
    expect(shortened).toMatchObject({ start: 3, trimStart: 2, duration: 5 });
    expect(shortened.volume.keyframes.map((k) => k.at)).toEqual([2]);
  });

  it("bounds the end edge by the file's end and the minimum length, shrinking fades to fit", () => {
    expect(trimAudioClip(audio("a"), "end", 30).duration).toBe(9);
    const tiny = trimAudioClip(audio("a"), "end", 2);
    expect(tiny.duration).toBeCloseTo(0.1);
    expect(tiny.fadeIn + tiny.fadeOut).toBeLessThanOrEqual(tiny.duration + 1e-9);
  });
});

describe("setAudioTrimStart", () => {
  it("keeps the start and shortens the clip when the file runs out", () => {
    expect(setAudioTrimStart(audio("a"), 2)).toMatchObject({ start: 2, trimStart: 2, duration: 6 });
    expect(setAudioTrimStart(audio("a"), 7)).toMatchObject({ trimStart: 7, duration: 3 });
    expect(setAudioTrimStart(audio("a"), 50).trimStart).toBeCloseTo(9.9);
  });
});

describe("setAudioFade", () => {
  it("caps at 5 s and at what the other fade leaves", () => {
    expect(setAudioFade(audio("a", { duration: 20, fadeOut: 0 }), "in", 9).fadeIn).toBe(5);
    expect(setAudioFade(audio("a"), "out", 9).fadeOut).toBe(5);
    expect(setAudioFade(audio("a", { duration: 3 }), "out", 9).fadeOut).toBe(2);
    expect(setAudioFade(audio("a"), "in", -1).fadeIn).toBe(0);
  });
});

describe("volume keyframes", () => {
  it("sets the static volume without keyframes, else the keyframe at the time", () => {
    expect(setVolumeAt(audio("a"), 1, 1.4).volume).toEqual({ value: 1, keyframes: [] });
    const clip = audio("a", { volume: { value: 1, keyframes: [keyed(1, 0.5)] } });
    expect(setVolumeAt(clip, 1, 0.2).volume.keyframes).toEqual([keyed(1, 0.2)]);
    expect(setVolumeAt(clip, 3, 0.7).volume.keyframes.map((k) => [k.at, k.value])).toEqual([
      [1, 0.5],
      [3, 0.7],
    ]);
  });

  it("toggles a keyframe holding the current value, and keeps it when the last one goes", () => {
    const added = toggleVolumeKeyframeAt(audio("a"), 2);
    expect(added.volume.keyframes.map((k) => [k.at, k.value])).toEqual([[2, 0.8]]);
    const edited = setVolumeAt(added, 2, 0.3);
    expect(toggleVolumeKeyframeAt(edited, 2).volume).toEqual({ value: 0.3, keyframes: [] });
    expect(addVolumeKeyframeAt(added, 2)).toBe(added);
  });

  it("moves selected keyframes as a group inside the clip", () => {
    const clip = audio("a", { volume: { value: 1, keyframes: [keyed(1, 0.5), keyed(4, 1)] } });
    expect(moveVolumeKeyframes(clip, ["k1", "k4"], 5).volume.keyframes.map((k) => k.at)).toEqual([3, 6]);
    expect(moveVolumeKeyframes(clip, ["k1"], -3).volume.keyframes.map((k) => k.at)).toEqual([0, 4]);
  });

  it("sets eases and removes keyframes", () => {
    const clip = audio("a", { volume: { value: 1, keyframes: [keyed(1, 0.5), keyed(4, 0.25)] } });
    expect(setVolumeKeyframeEase(clip, ["k4"], "hold").volume.keyframes[1]?.ease).toBe("hold");
    expect(removeVolumeKeyframes(clip, ["k1", "k4"]).volume).toEqual({ value: 0.5, keyframes: [] });
  });

  it("pastes copied keyframes at a time, keeping spacing and clamping to the clip", () => {
    const clip = audio("a", { volume: { value: 1, keyframes: [keyed(1, 0.5), keyed(2, 0.25)] } });
    const copied = copyVolumeKeyframes(clip, ["k1", "k2"]);
    const { clip: pasted, keyframeIds } = pasteVolumeKeyframes(clip, copied, 5.5);
    expect(keyframeIds).toHaveLength(2);
    expect(pasted.volume.keyframes.map((k) => [k.at, k.value])).toEqual([
      [1, 0.5],
      [2, 0.25],
      [5.5, 0.5],
      [6, 0.25],
    ]);
  });
});

describe("splitAudioClip", () => {
  it("cuts into two clips playing the same sound, splitting fades and keyframes", () => {
    const clip = audio("a", { volume: { value: 1, keyframes: [keyed(0, 0), keyed(4, 1)] } });
    const next = splitAudioClip(projectWith([clip]), "a", 4);
    const [left, right] = next.audioTracks[0]?.clips ?? [];
    expect(left).toMatchObject({ start: 2, duration: 2, trimStart: 1, fadeIn: 1, fadeOut: 0 });
    expect(right).toMatchObject({ start: 4, duration: 4, trimStart: 3, fadeIn: 0, fadeOut: 1 });
    expect(left?.volume.keyframes.map((k) => [k.at, k.value])).toEqual([
      [0, 0],
      [2, 0.5],
    ]);
    expect(right?.volume.keyframes.map((k) => [k.at, k.value])).toEqual([
      [0, 0.5],
      [2, 1],
    ]);
    expect(projectSchema.safeParse(next).success).toBe(true);
  });

  it("does nothing at an edge", () => {
    const project = projectWith([audio("a")]);
    expect(splitAudioClip(project, "a", 2.05)).toBe(project);
  });
});

describe("duplicateAudioClips and removeAudioClips", () => {
  it("places copies after the selection on their own tracks", () => {
    const project = projectWith([audio("a")], [audio("b", { start: 5, duration: 2 })]);
    const { project: next, clipIds } = duplicateAudioClips(project, ["a", "b"]);
    expect(clipIds).toHaveLength(2);
    expect(next.audioTracks.map((track) => track.clips.map((clip) => clip.start))).toEqual([
      [2, 8],
      [5, 11],
    ]);
    expect(removeAudioClips(next, clipIds).audioTracks.map((track) => track.clips.length)).toEqual([1, 1]);
  });
});
