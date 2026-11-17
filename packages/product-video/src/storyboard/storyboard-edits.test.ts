import { describe, expect, it } from "vitest";
import {
  addKeyframesAt,
  addVideoTrack,
  clipLocalTime,
  copyKeyframes,
  duplicateClip,
  duplicateClips,
  duplicateVideoTrack,
  editTimeFor,
  findClip,
  frameLocalTime,
  incomingOverlap,
  keyframePasteTime,
  keyframeTimes,
  moveClip,
  moveClips,
  moveKeyframe,
  nearestValidStart,
  pasteClips,
  pasteKeyframes,
  placeClip,
  placeClipNearest,
  quantiseClipKeyframes,
  quantiseProjectKeyframes,
  removeClip,
  removeKeyframe,
  removeLanes,
  removeTransition,
  removeVideoTrack,
  resetCamera,
  setClipDuration,
  setCompoundPropertyAt,
  setKeyframeEase,
  setPropertyAt,
  setTransitionLength,
  shiftKeyframes,
  snapToFrame,
  spansAreValid,
  splitClip,
  toggleKeyframeAt,
  toggleKeyframesAt,
  trimClip,
} from "./storyboard-edits";
import { createProject, createRecordingClip, createTextClip } from "./storyboard-factories";
import { type Clip, type Project, projectSchema } from "./storyboard-schema";

const clip: Clip = {
  id: "c",
  name: "Clip",
  start: 0,
  duration: 4,
  transitionIn: "crossfade",
  properties: {},
  source: { kind: "text", text: "Hi", size: "title", align: "center", weight: 600 },
};

describe("setPropertyAt", () => {
  it("changes the static value when the property has no keyframes", () => {
    const next = setPropertyAt(clip, "rotateY", 2, 25);
    expect(next.properties.rotateY).toEqual({ value: 25, keyframes: [] });
  });

  it("adds a keyframe at the playhead when the property is already keyframed", () => {
    const keyed = toggleKeyframeAt(clip, "zoom", 0);
    const next = setPropertyAt(keyed, "zoom", 3, 1.6);
    expect(next.properties.zoom?.keyframes.map((k) => [k.at, k.value])).toEqual([
      [0, 1],
      [3, 1.6],
    ]);
  });

  it("clamps to the property's range", () => {
    expect(setPropertyAt(clip, "zoom", 0, 99).properties.zoom?.value).toBe(10);
  });
});

describe("toggleKeyframeAt", () => {
  it("removes the keyframe at the playhead and keeps its value when it was the last one", () => {
    const keyed = setPropertyAt(toggleKeyframeAt(clip, "fov", 1), "fov", 1, 50);
    const cleared = toggleKeyframeAt(keyed, "fov", 1);
    expect(cleared.properties.fov).toEqual({ value: 50, keyframes: [] });
  });
});

function projectWith(...clips: Clip[]): Project {
  const project = createProject({ name: "Edits", now: new Date("2026-11-17T10:00:00Z") });
  return clips.reduce((current, next) => placeClip(current, 0, next), project);
}

const text = (id: string, start: number, duration = 3): Clip => ({
  ...createTextClip({ text: id, start, duration }),
  id,
});

const starts = (project: Project, trackIndex = 0) =>
  project.videoTracks[trackIndex]?.clips.map((candidate) => [
    candidate.id,
    candidate.start,
    candidate.duration,
  ]);

describe("spansAreValid", () => {
  it("matches the track schema", () => {
    expect(
      spansAreValid([
        { start: 0, duration: 3 },
        { start: 2.4, duration: 3 },
      ])
    ).toBe(true);
    expect(
      spansAreValid([
        { start: 0, duration: 5 },
        { start: 2.5, duration: 3 },
      ])
    ).toBe(false);
    expect(
      spansAreValid([
        { start: 0, duration: 1 },
        { start: 0, duration: 3 },
      ])
    ).toBe(false);
  });
});

describe("nearestValidStart", () => {
  it("keeps a valid start", () => {
    expect(nearestValidStart([{ start: 0, duration: 3 }], 3, 2.4)).toBe(2.4);
  });

  it("clamps an overlap to two seconds", () => {
    expect(nearestValidStart([{ start: 0, duration: 6 }], 4, 3)).toBe(4);
  });

  it("never covers a short clip", () => {
    expect(nearestValidStart([{ start: 0, duration: 1 }], 3, 0)).toBeCloseTo(0.1);
  });
});

describe("placeClip", () => {
  it("places at the clip's start when it fits, otherwise after the last clip", () => {
    const project = projectWith(text("a", 0), text("b", 0));
    expect(starts(project)).toEqual([
      ["a", 0, 3],
      ["b", 3, 3],
    ]);
    expect(projectSchema.safeParse(project).success).toBe(true);
  });
});

describe("moveClip", () => {
  it("creates an overlap when dragged over the previous clip", () => {
    const project = moveClip(projectWith(text("a", 0), text("b", 3)), "b", { start: 2.4, trackIndex: 0 });
    expect(starts(project)).toEqual([
      ["a", 0, 3],
      ["b", 2.4, 3],
    ]);
    expect(incomingOverlap(project.videoTracks[0], "b")).toBeCloseTo(0.6);
  });

  it("clamps rather than producing an invalid track", () => {
    const project = moveClip(projectWith(text("a", 0, 6), text("b", 6, 4)), "b", { start: 1, trackIndex: 0 });
    expect(findClip(project, "b")?.start).toBe(4);
    expect(projectSchema.safeParse(project).success).toBe(true);
  });

  it("moves a clip to another track", () => {
    const base = addVideoTrack(projectWith(text("a", 0), text("b", 3)), "Video 2");
    const project = moveClip(base, "b", { start: 1, trackIndex: 1 });
    expect(starts(project, 0)).toEqual([["a", 0, 3]]);
    expect(starts(project, 1)).toEqual([["b", 1, 3]]);
  });
});

describe("trimClip", () => {
  it("caps recordings at eight seconds", () => {
    const recording = { ...createRecordingClip({ name: "Rec", route: "/home" }), id: "r" };
    expect(findClip(trimClip(projectWith(recording), "r", "end", 20), "r")?.duration).toBe(8);
  });

  it("stops the end edge at the next clip's overlap limit", () => {
    const project = trimClip(projectWith(text("a", 0, 3), text("b", 3, 3)), "a", "end", 9);
    expect(findClip(project, "a")?.duration).toBe(5);
    expect(projectSchema.safeParse(project).success).toBe(true);
  });

  it("keeps keyframes in place when trimming the start", () => {
    const keyed = setPropertyAt(toggleKeyframeAt(text("a", 0, 4), "zoom", 2), "zoom", 2, 1.5);
    const project = trimClip(projectWith(keyed), "a", "start", 1);
    const clip = findClip(project, "a");
    expect([clip?.start, clip?.duration, clip?.properties.zoom?.keyframes[0]?.at]).toEqual([1, 3, 1]);
  });

  it("pulls keyframes inside when trimming the end", () => {
    const keyed = toggleKeyframeAt(text("a", 0, 4), "zoom", 3.5);
    const clip = findClip(setClipDuration(projectWith(keyed), "a", 2), "a");
    expect(clip?.properties.zoom?.keyframes[0]?.at).toBe(2);
  });

  it("moves an import's trim with its start edge", () => {
    const imported: Clip = {
      ...text("i", 2, 4),
      source: {
        kind: "import",
        file: "imports/a.mp4",
        trimStart: 1,
        fileDuration: 10,
        width: 1920,
        height: 1080,
      },
    };
    const project = trimClip(projectWith(imported), "i", "start", 0);
    const clip = findClip(project, "i");
    expect([clip?.start, clip?.duration, clip?.source.kind === "import" && clip.source.trimStart]).toEqual([
      1, 5, 0,
    ]);
  });
});

describe("removeClip and duplicateClip", () => {
  it("duplicates after the original with fresh ids", () => {
    const keyed = toggleKeyframeAt(text("a", 0), "zoom", 1);
    const result = duplicateClip(projectWith(keyed), "a");
    const copy = result && findClip(result.project, result.clipId);
    expect(copy?.start).toBe(3);
    expect(copy?.properties.zoom?.keyframes[0]?.id).not.toBe(keyed.properties.zoom?.keyframes[0]?.id);
    expect(removeClip(result?.project ?? projectWith(), "a").videoTracks[0].clips).toHaveLength(1);
  });
});

describe("keyframe edits", () => {
  const keyed = setPropertyAt(toggleKeyframeAt(toggleKeyframeAt(clip, "zoom", 0), "zoom", 3), "zoom", 3, 1.6);
  const late = keyed.properties.zoom?.keyframes[1]?.id ?? "";

  it("retimes a keyframe within the clip", () => {
    expect(moveKeyframe(keyed, "zoom", late, 2).properties.zoom?.keyframes.map((k) => k.at)).toEqual([0, 2]);
    expect(moveKeyframe(keyed, "zoom", late, 9).properties.zoom?.keyframes[1]?.at).toBe(4);
  });

  it("sets a keyframe's ease", () => {
    expect(setKeyframeEase(keyed, "zoom", late, "hold").properties.zoom?.keyframes[1]?.ease).toBe("hold");
  });

  it("removes a keyframe", () => {
    expect(removeKeyframe(keyed, "zoom", late).properties.zoom?.keyframes).toHaveLength(1);
  });
});

describe("clipLocalTime", () => {
  it("holds at the clip's ends", () => {
    expect([clipLocalTime(clip, -1), clipLocalTime(clip, 2), clipLocalTime(clip, 9)]).toEqual([0, 2, 4]);
  });
});

describe("splitClip", () => {
  it("cuts a clip in two that animate the same", () => {
    const keyed = setPropertyAt(
      toggleKeyframeAt(toggleKeyframeAt(text("a", 0, 4), "zoom", 0), "zoom", 4),
      "zoom",
      4,
      2
    );
    const result = splitClip(projectWith(keyed), "a", 1);
    const head = result && findClip(result.project, "a");
    const tail = result && findClip(result.project, result.clipId);
    expect([head?.duration, tail?.start, tail?.duration]).toEqual([1, 1, 3]);
    const headKeys = head?.properties.zoom?.keyframes.map((k) => [k.at, k.value]);
    const tailKeys = tail?.properties.zoom?.keyframes.map((k) => [k.at, k.value]);
    expect(headKeys?.[1]?.[0]).toBe(1);
    expect(tailKeys?.[0]).toEqual([0, headKeys?.[1]?.[1]]);
    expect(tailKeys?.[1]).toEqual([3, 2]);
    expect(result && projectSchema.safeParse(result.project).success).toBe(true);
  });

  it("refuses a cut at the edge", () => {
    expect(splitClip(projectWith(text("a", 0)), "a", 0)).toBeNull();
  });
});

describe("multi-clip edits", () => {
  it("duplicates a selection after its span, keeping spacing", () => {
    const result = duplicateClips(projectWith(text("a", 0, 2), text("b", 3, 2)), ["a", "b"]);
    expect(result.project.videoTracks[0].clips.map((c) => c.start)).toEqual([0, 3, 5, 8]);
  });

  it("pastes at a time on the original tracks", () => {
    const base = addVideoTrack(projectWith(text("a", 0, 2)), "Video 2");
    const result = pasteClips(base, [{ clip: text("t", 1, 2), trackIndex: 1 }], 6);
    expect(starts(result.project, 1)?.map(([, start]) => start)).toEqual([6]);
  });

  it("moves a selection together or not at all", () => {
    const base = projectWith(text("a", 0, 2), text("b", 2, 2), text("c", 6, 2));
    expect(starts(moveClips(base, ["a", "b"], 1) ?? base)?.map(([, start]) => start)).toEqual([1, 3, 6]);
    expect(moveClips(base, ["a", "b"], -1)).toBeNull();
    expect(moveClips(base, ["a", "b"], 6)).toBeNull();
  });
});

describe("track edits", () => {
  it("duplicates a track with fresh ids and keeps the last track", () => {
    const base = projectWith(text("a", 0));
    const copied = duplicateVideoTrack(base, 0, "Video 2");
    expect(copied.videoTracks[1]?.clips[0]?.id).not.toBe("a");
    expect(removeVideoTrack(base, 0)).toBe(base);
    expect(removeVideoTrack(copied, 0).videoTracks).toHaveLength(1);
  });
});

describe("transition edits", () => {
  it("sets and removes the overlap", () => {
    const base = projectWith(text("a", 0), text("b", 3));
    expect(findClip(setTransitionLength(base, "b", 1), "b")?.start).toBe(2);
    expect(findClip(setTransitionLength(base, "b", 5), "b")?.start).toBe(1);
    expect(findClip(removeTransition(setTransitionLength(base, "b", 1), "b"), "b")?.start).toBe(3);
  });
});

describe("keyframe group edits", () => {
  it("adds, toggles and shifts keyframes together", () => {
    const camera = ["cameraX", "zoom"] as const;
    const keyed = addKeyframesAt(clip, camera, 1);
    expect(keyframeTimes(keyed)).toEqual([1]);
    expect(keyframeTimes(toggleKeyframesAt(keyed, camera, 1))).toEqual([]);
    const refs = camera.map((key) => ({ key, keyframeId: keyed.properties[key]?.keyframes[0]?.id ?? "" }));
    expect(keyframeTimes(shiftKeyframes(keyed, refs, 9))).toEqual([4]);
    expect(resetCamera(keyed).properties).toEqual({});
  });
});

describe("removeLanes", () => {
  it("drops the lanes' keyframes, keeping the value at the playhead", () => {
    const keyed = setPropertyAt(setPropertyAt(toggleKeyframeAt(clip, "zoom", 0), "zoom", 0, 1), "zoom", 2, 2);
    const next = removeLanes(keyed, ["zoom", "fov"], 1);
    expect(next.properties.zoom).toEqual({ value: 1.5, keyframes: [] });
    expect(next.properties.fov).toBeUndefined();
  });
});

describe("placeClipNearest", () => {
  it("drops onto the nearest valid start", () => {
    const project = placeClipNearest(projectWith(text("a", 0, 4)), 0, text("b", 1, 3));
    expect(findClip(project, "b")?.start).toBe(2);
  });
});

describe("keyframe copy and paste", () => {
  const keyed = setPropertyAt(
    setPropertyAt(toggleKeyframeAt(toggleKeyframeAt(clip, "zoom", 1), "zoom", 1.5), "zoom", 1.5, 2),
    "zoom",
    1,
    1.2
  );
  const refs = (keyed.properties.zoom?.keyframes ?? []).map((k) => ({
    key: "zoom" as const,
    keyframeId: k.id,
  }));

  it("pastes five frames after the anchor", () => {
    expect(keyframePasteTime(1, 60)).toBeCloseTo(1 + 5 / 60);
    expect(keyframePasteTime(2, 30)).toBeCloseTo(2 + 1 / 6);
  });

  it("keeps relative timing, values and eases, and returns the new refs", () => {
    const copied = copyKeyframes(keyed, refs);
    const result = pasteKeyframes(keyed, copied, 2.5);
    expect(result.clip.properties.zoom?.keyframes.map((k) => [k.at, k.value])).toEqual([
      [1, 1.2],
      [1.5, 2],
      [2.5, 1.2],
      [3, 2],
    ]);
    expect(result.refs).toHaveLength(2);
  });

  it("clamps within the clip and can target another lane", () => {
    const result = pasteKeyframes(keyed, copyKeyframes(keyed, refs), 3.8, "scale");
    expect(result.clip.properties.scale?.keyframes.map((k) => [k.at, k.value])).toEqual([
      [3.8, 1.2],
      [4, 2],
    ]);
  });
});

describe("frame grid", () => {
  it("snaps project time to frames and converts to clip time", () => {
    expect(snapToFrame(0.0342, 30)).toBeCloseTo(1 / 30);
    expect(snapToFrame(1.01, 30)).toBeCloseTo(1);
    expect(frameLocalTime({ start: 3.7, duration: 4 }, 3.7342, 30)).toBeCloseTo(3.7333 - 3.7, 3);
  });

  it("normalises off-grid keyframes in project time and keeps one per frame", () => {
    const offGrid: Clip = {
      ...text("a", 3.7, 4),
      properties: {
        rotateX: {
          value: 0,
          keyframes: [
            { id: "k1", at: 0.0407, value: -22.5, ease: "ease-in-out" },
            { id: "k2", at: 0.045, value: -20, ease: "ease-in-out" },
            { id: "k3", at: 3.2675, value: 7, ease: "ease-in-out" },
          ],
        },
      },
    };
    const fixed = quantiseClipKeyframes(offGrid, 30);
    const frames = fixed.properties.rotateX?.keyframes.map((k) => (fixed.start + k.at) * 30);
    expect(frames?.map((frame) => Math.abs(frame - Math.round(frame)) < 1e-6)).toEqual([true, true]);
    expect(fixed.properties.rotateX?.keyframes.map((k) => k.value)).toEqual([-20, 7]);
    expect(quantiseClipKeyframes(fixed, 30)).toBe(fixed);
  });

  it("leaves an on-grid project untouched", () => {
    const project = projectWith(toggleKeyframeAt(text("a", 0), "zoom", 1));
    expect(quantiseProjectKeyframes(project)).toBe(project);
  });
});

describe("setCompoundPropertyAt", () => {
  it("keys every rotation axis once any axis is keyed", () => {
    const keyed = setPropertyAt(toggleKeyframeAt(clip, "rotateX", 0), "rotateX", 0, -20);
    const edited = setCompoundPropertyAt(keyed, "rotateY", 2, 30);
    expect(Object.keys(edited.properties).sort()).toEqual(["rotateX", "rotateY", "rotateZ"]);
    expect(edited.properties.rotateY?.keyframes.map((k) => [k.at, k.value])).toEqual([[2, 30]]);
    expect(edited.properties.rotateZ?.keyframes.map((k) => [k.at, k.value])).toEqual([[2, 0]]);
    expect(edited.properties.rotateX?.keyframes.map((k) => [k.at, k.value])).toEqual([
      [0, -20],
      [2, -20],
    ]);
  });

  it("changes only the static value when no axis is keyed, and never touches another compound", () => {
    const edited = setCompoundPropertyAt(toggleKeyframeAt(clip, "cameraY", 0), "rotateY", 1, 15);
    expect(edited.properties.rotateY).toEqual({ value: 15, keyframes: [] });
    expect(edited.properties.rotateZ).toBeUndefined();
  });
});

describe("editTimeFor", () => {
  const keyed = toggleKeyframeAt(clip, "rotateX", 1);
  const ref = { key: "rotateX" as const, keyframeId: keyed.properties.rotateX?.keyframes[0]?.id ?? "" };

  it("prefers a selected keyframe within half a frame of the playhead", () => {
    expect(editTimeFor(keyed, ["rotateX", "rotateY"], [ref], 1.01, 30)).toBe(1);
  });

  it("uses the playhead when the selected keyframe is further away or on another property", () => {
    expect(editTimeFor(keyed, ["rotateX"], [ref], 1.5, 30)).toBe(1.5);
    expect(editTimeFor(keyed, ["cameraX"], [ref], 1.01, 30)).toBe(1.01);
  });
});
