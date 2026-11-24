import { toggleKeyframeAt } from "@coss/vaunt-engine/storyboard/storyboard-edits";
import { createProject, createTextClip } from "@coss/vaunt-engine/storyboard/storyboard-factories";
import { describe, expect, it } from "vitest";
import {
  EMPTY_SELECTION,
  primaryClipId,
  pruneSelection,
  selectClip,
  selectClips,
  selectKeyframes,
} from "./editor-selection";

const keyframe = (keyframeId: string, clipId = "a") => ({ clipId, key: "zoom" as const, keyframeId });

describe("clip selection", () => {
  it("replaces on click and toggles on Shift or ⌘ click", () => {
    const one = selectClip(EMPTY_SELECTION, "a", false);
    const two = selectClip(one, "b", true);
    expect(two.clipIds).toEqual(["a", "b"]);
    expect(primaryClipId(two)).toBe("b");
    expect(selectClip(two, "a", true).clipIds).toEqual(["b"]);
    expect(selectClip(two, "c", false).clipIds).toEqual(["c"]);
  });

  it("adds a marquee to the selection", () => {
    expect(selectClips({ clipIds: ["a"], keyframes: [] }, ["a", "b"], true).clipIds).toEqual(["a", "b"]);
  });
});

describe("keyframe selection", () => {
  it("toggles keyframes and keeps their clip selected", () => {
    const one = selectKeyframes(EMPTY_SELECTION, [keyframe("k1")], false);
    expect(one.clipIds).toEqual(["a"]);
    const two = selectKeyframes(one, [keyframe("k2")], true);
    expect(two.keyframes.map((k) => k.keyframeId)).toEqual(["k1", "k2"]);
    expect(selectKeyframes(two, [keyframe("k1")], true).keyframes.map((k) => k.keyframeId)).toEqual(["k2"]);
  });
});

describe("pruneSelection", () => {
  it("drops clips and keyframes that are gone", () => {
    const base = createProject({ name: "Prune", now: new Date(0) });
    const clip = toggleKeyframeAt({ ...createTextClip({ text: "a" }), id: "a" }, "zoom", 0);
    const project = { ...base, videoTracks: [{ ...base.videoTracks[0], clips: [clip] }] };
    const id = clip.properties.zoom?.keyframes[0]?.id ?? "";
    const selection = { clipIds: ["a", "gone"], keyframes: [keyframe(id), keyframe("gone")] };
    expect(pruneSelection(selection, project)).toEqual({ clipIds: ["a"], keyframes: [keyframe(id)] });
  });
});
