import { describe, expect, it } from "vitest";
import { insertBoardNode } from "./board-edits";
import { applyGeneratedClips } from "./board-generation";
import type { Board, BoardNode } from "./board-schema";
import { syncBoardEdits } from "./board-sync";
import {
  addKeyframesAt,
  ensureVideoTrack,
  findClip,
  insertVideoTrack,
  moveClip,
  moveClips,
  placeClipNearest,
  quantiseProjectKeyframes,
  setPropertyAt,
  updateClip,
} from "./storyboard-edits";
import { createProject, createTextClip } from "./storyboard-factories";
import { type Clip, type Project, projectSchema } from "./storyboard-schema";

/*
 * Keyframes the author adds must survive every other edit: new media, moves between tracks, overlaps, new tracks,
 * new scenes on the board and generating them. Each edit goes through the editor's pipeline: the edit on the
 * latest project, the board sync, keyframes onto the frame grid, then validation.
 */

const textNode = (id: string, y: number): BoardNode => ({
  id,
  kind: "text",
  title: id,
  notes: "",
  duration: 2,
  position: { x: 0, y },
  words: id,
});

const textClip = (id: string, start: number, duration: number, nodeId?: string): Clip => ({
  ...createTextClip({ text: id, start, duration }),
  id,
  storyboardNodeId: nodeId,
});

const imageClip = (id: string, start: number, duration: number): Clip => ({
  id,
  name: `${id}.png`,
  start,
  duration,
  transitionIn: "crossfade",
  properties: {},
  source: { kind: "image", file: `imports/${id}.png`, width: 640, height: 360 },
});

/** A fresh clip as generation returns it: same id when the scene had one, and no animation. */
const generatedClip = (previous: Clip | null, nodeId: string, duration = 2): Clip =>
  textClip(previous?.id ?? `${nodeId}-generated`, 0, duration);

function startingProject(): Project {
  const base = createProject({ name: "Keyframes", now: new Date("2026-11-26T08:00:00Z") });
  const board: Board = {
    brief: "Launch",
    nodes: [textNode("hook", 0), textNode("scene", 112)],
    edges: [{ id: "hook-scene", from: "hook", to: "scene", transition: "crossfade", transitionSeconds: 0.5 }],
  };
  return {
    ...base,
    storyboard: board,
    videoTracks: [
      {
        ...base.videoTracks[0],
        clips: [textClip("hook-clip", 0, 2, "hook"), textClip("scene-clip", 1.5, 2, "scene")],
      },
    ],
  };
}

/** Keys a zoom animation from the clip start to `to`, and a static opacity, as the inspector does. */
const animate = (clip: Clip, to: number): Clip =>
  setPropertyAt(setPropertyAt(addKeyframesAt(clip, ["zoom"], 0), "zoom", to, 1.6), "opacity", 0, 0.8);

class Editor {
  project: Project;
  constructor(project: Project) {
    this.project = quantiseProjectKeyframes(syncBoardEdits(project, project).project);
  }

  edit(label: string, update: (current: Project) => Project): void {
    const result = syncBoardEdits(this.project, update(this.project));
    const next = quantiseProjectKeyframes(result.project);
    const parsed = projectSchema.safeParse(next);
    expect(parsed.success, `${label}: ${parsed.error?.issues[0]?.message}`).toBe(true);
    expect(result.refused, label).toEqual([]);
    this.project = next;
  }

  clip(clipId: string): Clip {
    const clip = findClip(this.project, clipId);
    expect(clip, clipId).not.toBeNull();
    return clip as Clip;
  }

  trackOf(clipId: string): number {
    return this.project.videoTracks.findIndex((track) => track.clips.some((clip) => clip.id === clipId));
  }

  generate(nodeId: string, duration?: number): void {
    const previous = this.project.videoTracks
      .flatMap((track) => track.clips)
      .find((clip) => clip.storyboardNodeId === nodeId);
    this.edit(`generate ${nodeId}`, (current) =>
      applyGeneratedClips(current, nodeId, [generatedClip(previous ?? null, nodeId, duration)])
    );
  }
}

/** Every keyframe id per clip and property, and each property's static value. */
function animationOf(clip: Clip): Record<string, { value: number; keyframes: string[] }> {
  return Object.fromEntries(
    Object.entries(clip.properties).map(([key, property]) => [
      key,
      { value: property.value, keyframes: property.keyframes.map((keyframe) => keyframe.id) },
    ])
  );
}

describe("keyframes survive other edits", () => {
  it("keeps every clip's animation through new media, track moves, overlaps, new scenes and generation", () => {
    const editor = new Editor(startingProject());
    editor.edit("animate hook", (current) => updateClip(current, "hook-clip", (clip) => animate(clip, 1.5)));
    editor.edit("animate scene", (current) => updateClip(current, "scene-clip", (clip) => animate(clip, 1)));

    const expected = new Map<string, ReturnType<typeof animationOf>>();
    const remember = (clipId: string) => expected.set(clipId, animationOf(editor.clip(clipId)));
    const check = (step: string) => {
      for (const [clipId, animation] of expected) {
        expect(animationOf(editor.clip(clipId)), `${clipId} after ${step}`).toEqual(animation);
      }
    };
    remember("hook-clip");
    remember("scene-clip");

    // New media on the same track, overlapping the scene before it; then animated itself.
    editor.edit("drop media", (current) => placeClipNearest(current, 0, imageClip("shot", 3.2, 2)));
    check("drop media");
    editor.edit("animate media", (current) => updateClip(current, "shot", (clip) => animate(clip, 1.25)));
    remember("shot");

    // New media dropped on the new-track row above the top track.
    editor.edit("drop on new track", (current) =>
      placeClipNearest(ensureVideoTrack(current, 1, "Video 2"), 1, imageClip("overlay", 0.5, 3))
    );
    check("drop on new track");
    editor.edit("animate overlay", (current) => updateClip(current, "overlay", (clip) => animate(clip, 2)));
    remember("overlay");

    // An animated clip moved onto another track, landing over the clip there.
    editor.edit("move to track 2", (current) => moveClip(current, "scene-clip", { start: 1, trackIndex: 1 }));
    expect(editor.trackOf("scene-clip")).toBe(1);
    check("move to track 2");

    // Moved onto a track that doesn't exist yet, at an off-frame time.
    editor.edit("move to a new track", (current) =>
      moveClip(ensureVideoTrack(current, 2, "Video 3"), "shot", { start: 2.0137, trackIndex: 2 })
    );
    expect(editor.trackOf("shot")).toBe(2);
    check("move to a new track");

    // A track inserted below shifts every track's index.
    editor.edit("insert track", (current) => insertVideoTrack(current, 0, "Video 0"));
    check("insert track");

    // A selection dragged down a track and later in time.
    editor.edit("drag selection", (current) => moveClips(current, ["shot", "overlay"], 0.25, -1) ?? current);
    check("drag selection");

    // Overlapping two clips on one track by dragging one into the other.
    const overlayTrack = editor.trackOf("overlay");
    const overlayEnd = editor.clip("overlay").start + editor.clip("overlay").duration;
    editor.edit("overlap", (current) =>
      moveClip(current, "hook-clip", { start: overlayEnd - 0.5, trackIndex: overlayTrack })
    );
    expect(editor.trackOf("hook-clip")).toBe(overlayTrack);
    check("overlap");

    // A new scene on the board, generated: the other clips shift but keep their animation.
    editor.edit("add scene", (current) => ({
      ...current,
      storyboard: insertBoardNode(current.storyboard as Board, textNode("outro", 0), "scene"),
    }));
    check("add scene");
    editor.generate("outro");
    check("generate the new scene");

    // Generating the whole board again replaces every scene's clip.
    for (const node of editor.project.storyboard?.nodes ?? []) editor.generate(node.id);
    check("generate the board");
  });

  it("keeps the animation when a regenerated scene comes back shorter, up to its new end", () => {
    const editor = new Editor(startingProject());
    editor.edit("animate hook", (current) => updateClip(current, "hook-clip", (clip) => animate(clip, 1.5)));
    editor.generate("hook", 1);
    const zoom = editor.clip("hook-clip").properties.zoom;
    expect(zoom?.keyframes.map((keyframe) => keyframe.at)).toEqual([0]);
    expect(editor.clip("hook-clip").properties.opacity?.value).toBe(0.8);
  });
});
