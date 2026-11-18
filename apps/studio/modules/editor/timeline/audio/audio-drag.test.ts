import { findAudioClip } from "@calcom/product-video/audio/audio-edits";
import { createProject } from "@calcom/product-video/storyboard/storyboard-factories";
import type { AudioClip, Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { describe, expect, it } from "vitest";
import { type AudioDrag, applyAudioDrag } from "./audio-drag";

const audio = (id: string, overrides: Partial<AudioClip> = {}): AudioClip => ({
  id,
  name: id,
  file: `imports/${id}.mp3`,
  kind: "music",
  start: 2,
  duration: 4,
  trimStart: 1,
  fileDuration: 10,
  volume: { value: 0.5, keyframes: [] },
  fadeIn: 0,
  fadeOut: 0,
  ...overrides,
});

const project = (...tracks: AudioClip[][]): Project => ({
  ...createProject({ name: "p", now: new Date("2026-11-17T00:00:00Z") }),
  audioTracks: tracks.map((clips, index) => ({ id: `t${index}`, name: `A${index}`, clips })),
});

const drag = (overrides: Partial<AudioDrag>): AudioDrag => ({
  mode: "move",
  clipId: "a",
  ids: ["a"],
  seconds: 0,
  heightFraction: 0,
  trackDelta: 0,
  newTrackName: "Audio 9",
  snap: { targets: [0, 10], thresholdSeconds: 0.2, free: false },
  frameSeconds: 1 / 60,
  ...overrides,
});

const clipOf = (next: Project, id = "a") => findAudioClip(next, id)?.clip;

describe("applyAudioDrag", () => {
  it("moves onto the 0.1 s grid, snaps an edge to a target, and moves freely with Shift", () => {
    const base = project([audio("a")]);
    expect(clipOf(applyAudioDrag(base, drag({ seconds: 1.234 })))?.start).toBe(3.2);
    expect(clipOf(applyAudioDrag(base, drag({ seconds: 3.9 })))?.start).toBe(6);
    const free = drag({ seconds: 1.234, snap: { targets: [], thresholdSeconds: 0.2, free: true } });
    expect(clipOf(applyAudioDrag(base, free))?.start).toBeCloseTo(3.234);
  });

  it("moves to another track", () => {
    const next = applyAudioDrag(project([audio("a")], []), drag({ trackDelta: 1 }));
    expect(findAudioClip(next, "a")?.trackIndex).toBe(1);
  });

  it("adds a track when the clip moves onto the new-track row below the last one", () => {
    const next = applyAudioDrag(project([audio("a")]), drag({ trackDelta: 1 }));
    expect(next.audioTracks.map((track) => track.name)).toEqual(["A0", "Audio 9"]);
    expect(findAudioClip(next, "a")?.trackIndex).toBe(1);
  });

  it("trims the left edge into the file's head and the right edge to its end", () => {
    const base = project([audio("a")]);
    expect(clipOf(applyAudioDrag(base, drag({ mode: "trim-start", seconds: -3 })))).toMatchObject({
      start: 1,
      trimStart: 0,
      duration: 5,
    });
    expect(clipOf(applyAudioDrag(base, drag({ mode: "trim-end", seconds: 20 })))?.duration).toBe(9);
  });

  it("sets fades from the handle's travel, the fade out growing leftward", () => {
    const base = project([audio("a")]);
    expect(clipOf(applyAudioDrag(base, drag({ mode: "fade-in", seconds: 1.5 })))?.fadeIn).toBe(1.5);
    expect(clipOf(applyAudioDrag(base, drag({ mode: "fade-out", seconds: -1 })))?.fadeOut).toBe(1);
  });

  it("drags the static volume line, but not once volume is keyframed", () => {
    const base = project([audio("a")]);
    expect(clipOf(applyAudioDrag(base, drag({ mode: "volume", heightFraction: -0.3 })))?.volume.value).toBe(
      0.8
    );
    const keyed = project([
      audio("a", { volume: { value: 1, keyframes: [{ id: "k", at: 1, value: 1, ease: "linear" }] } }),
    ]);
    expect(applyAudioDrag(keyed, drag({ mode: "volume", heightFraction: 0.5 }))).toBe(keyed);
  });

  it("moves keyframes in whole frames", () => {
    const base = project([
      audio("a", { volume: { value: 1, keyframes: [{ id: "k", at: 1, value: 1, ease: "linear" }] } }),
    ]);
    const next = applyAudioDrag(base, drag({ mode: "keyframes", ids: ["k"], seconds: 0.505 }));
    expect(clipOf(next)?.volume.keyframes[0]?.at).toBeCloseTo(1.5);
  });
});
