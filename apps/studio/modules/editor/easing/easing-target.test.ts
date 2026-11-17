import { createProject, createTextClip } from "@calcom/product-video/storyboard/storyboard-factories";
import type { AudioClip, Ease, Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { describe, expect, it } from "vitest";
import { EMPTY_AUDIO_SELECTION } from "../audio/audio-selection";
import { EMPTY_SELECTION } from "../editor-selection";
import { easingTarget, easingTargetKey, summariseEases } from "./easing-target";

const custom: Ease = { cubic: [0.1, 0.2, 0.3, 1] };

const video = {
  ...createTextClip({ text: "Hi" }),
  id: "v",
  properties: {
    zoom: {
      value: 1,
      keyframes: [
        { id: "z1", at: 0, value: 1, ease: "linear" as const },
        { id: "z2", at: 1, value: 2, ease: custom },
      ],
    },
  },
};

const audio: AudioClip = {
  id: "a",
  name: "a",
  file: "imports/a.mp3",
  kind: "music",
  start: 0,
  duration: 5,
  trimStart: 0,
  fileDuration: 5,
  volume: { value: 1, keyframes: [{ id: "v1", at: 1, value: 0.5, ease: "hold" }] },
  fadeIn: 0,
  fadeOut: 0,
};

const project: Project = {
  ...createProject({ name: "p", now: new Date("2026-11-17T00:00:00Z") }),
  videoTracks: [{ id: "t", name: "Video", clips: [video] }],
  audioTracks: [{ id: "u", name: "Audio", clips: [audio] }],
};

describe("easingTarget", () => {
  it("is null with nothing selected", () => {
    expect(easingTarget(project, EMPTY_SELECTION, EMPTY_AUDIO_SELECTION)).toBeNull();
  });

  it("collects the selected keyframes of the primary video clip, skipping stale refs", () => {
    const target = easingTarget(
      project,
      {
        clipIds: ["v"],
        keyframes: [
          { clipId: "v", key: "zoom", keyframeId: "z2" },
          { clipId: "v", key: "zoom", keyframeId: "gone" },
        ],
      },
      EMPTY_AUDIO_SELECTION
    );
    expect(target).toEqual({
      kind: "video",
      clipId: "v",
      refs: [{ clipId: "v", key: "zoom", keyframeId: "z2" }],
      eases: [custom],
    });
  });

  it("falls back to selected volume keyframes", () => {
    const target = easingTarget(project, EMPTY_SELECTION, { clipIds: ["a"], keyframeIds: ["v1"] });
    expect(target).toEqual({ kind: "audio", clipId: "a", keyframeIds: ["v1"], eases: ["hold"] });
    expect(easingTargetKey(target)).toBe("v1");
    expect(easingTargetKey(null)).toBe("none");
  });

  it("is null when a clip is selected without keyframes", () => {
    expect(easingTarget(project, { clipIds: ["v"], keyframes: [] }, EMPTY_AUDIO_SELECTION)).toBeNull();
  });
});

describe("summariseEases", () => {
  it("is null for no eases", () => {
    expect(summariseEases([])).toBeNull();
  });

  it("shows the first ease and flags a mixed selection", () => {
    expect(summariseEases(["linear", "linear"])).toEqual({ ease: "linear", mixed: false });
    expect(summariseEases([custom, { cubic: [0.1, 0.2, 0.3, 1] }])).toEqual({ ease: custom, mixed: false });
    expect(summariseEases([custom, "linear"])).toEqual({ ease: custom, mixed: true });
  });
});
