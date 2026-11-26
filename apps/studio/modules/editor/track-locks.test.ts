import { createProject, createTextClip } from "@coss/vaunt-engine/storyboard/storyboard-factories";
import type { AudioClip, Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { describe, expect, it } from "vitest";
import { pruneAudioSelection } from "./audio/audio-selection";
import { pruneSelection } from "./editor-selection";
import {
  changesLockedTracks,
  dropTrackIndex,
  isClipLocked,
  lockedClipIds,
  withoutLockedClips,
} from "./track-locks";

const text = (id: string, start: number) => ({ ...createTextClip({ text: id, start }), id, duration: 1 });

const audio = (id: string): AudioClip => ({
  id,
  name: id,
  file: `imports/${id}.mp3`,
  kind: "music",
  start: 0,
  duration: 5,
  trimStart: 0,
  fileDuration: 5,
  volume: { value: 1, keyframes: [] },
  fadeIn: 0,
  fadeOut: 0,
});

/** Track `bottom` holds clip a, track `top` (locked) holds b and c; audio `music` (locked) holds m. */
function lockedProject(): Project {
  const base = createProject({ name: "Locks", now: new Date(0) });
  return {
    ...base,
    videoTracks: [
      { id: "bottom", name: "Bottom", clips: [text("a", 0)] },
      { id: "top", name: "Top", clips: [text("b", 0), text("c", 2)], locked: true },
    ],
    audioTracks: [
      { id: "music", name: "Music", clips: [audio("m")], locked: true },
      { id: "sfx", name: "Sfx", clips: [audio("s")] },
    ],
  };
}

const withTrack = (
  project: Project,
  index: number,
  update: (p: Project["videoTracks"][number]) => object
) => ({
  ...project,
  videoTracks: project.videoTracks.map((track, i) => (i === index ? { ...track, ...update(track) } : track)),
});

describe("locked clips", () => {
  it("lists clips on locked video and audio tracks", () => {
    const project = lockedProject();
    expect([...lockedClipIds(project)].sort()).toEqual(["b", "c", "m"]);
    expect(isClipLocked(project, "b")).toBe(true);
    expect(isClipLocked(project, "a")).toBe(false);
    expect(withoutLockedClips(["a", "b", "s", "m"], project)).toEqual(["a", "s"]);
  });

  it("drops them from the selection, so marquee, select all and a newly locked track can't keep them", () => {
    const project = lockedProject();
    const selection = {
      clipIds: ["a", "b", "c"],
      keyframes: [{ clipId: "b", key: "zoom" as const, keyframeId: "k" }],
    };
    expect(pruneSelection(selection, project)).toEqual({ clipIds: ["a"], keyframes: [] });
    expect(pruneAudioSelection({ clipIds: ["m", "s"], keyframeIds: [] }, project)).toEqual({
      clipIds: ["s"],
      keyframeIds: [],
    });
    const unlocked = withTrack(project, 1, () => ({ locked: undefined }));
    expect(pruneSelection(selection, unlocked).clipIds).toEqual(["a", "b", "c"]);
  });
});

describe("changesLockedTracks", () => {
  it("refuses edits to, moves out of and drops onto a locked track", () => {
    const project = lockedProject();
    const edited = withTrack(project, 1, (track) => ({
      clips: track.clips.map((clip) => (clip.id === "b" ? { ...clip, start: 0.5 } : clip)),
    }));
    expect(changesLockedTracks(project, edited)).toBe(true);
    const removed = withTrack(project, 1, (track) => ({ clips: track.clips.slice(1) }));
    expect(changesLockedTracks(project, removed)).toBe(true);
    const dropped = withTrack(project, 1, (track) => ({ clips: [...track.clips, text("d", 4)] }));
    expect(changesLockedTracks(project, dropped)).toBe(true);
    const audioEdit = {
      ...project,
      audioTracks: project.audioTracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => ({ ...clip, fadeIn: 1 })),
      })),
    };
    expect(changesLockedTracks(project, audioEdit)).toBe(true);
  });

  it("allows edits elsewhere, locking, unlocking, an equal copy and removing the track", () => {
    const project = lockedProject();
    const elsewhere = withTrack(project, 0, (track) => ({
      clips: track.clips.map((clip) => ({ ...clip, start: 3 })),
    }));
    expect(changesLockedTracks(project, elsewhere)).toBe(false);
    expect(
      changesLockedTracks(
        project,
        withTrack(project, 0, () => ({ locked: true }))
      )
    ).toBe(false);
    const unlockedAndEdited = withTrack(project, 1, (track) => ({
      locked: undefined,
      clips: track.clips.slice(1),
    }));
    expect(changesLockedTracks(project, unlockedAndEdited)).toBe(false);
    expect(changesLockedTracks(project, structuredClone(project))).toBe(false);
    expect(changesLockedTracks(project, { ...project, videoTracks: project.videoTracks.slice(0, 1) })).toBe(
      false
    );
  });
});

describe("dropTrackIndex", () => {
  it("keeps a dragged clip on its last track while it's over a locked one", () => {
    const tracks = [{}, { locked: true }, {}];
    expect(dropTrackIndex(tracks, 2, 0)).toBe(2);
    expect(dropTrackIndex(tracks, 1, 0)).toBe(0);
    expect(dropTrackIndex(tracks, 1, 2)).toBe(2);
    // One past the top adds a track, which is never locked.
    expect(dropTrackIndex(tracks, 3, 2)).toBe(3);
  });
});
