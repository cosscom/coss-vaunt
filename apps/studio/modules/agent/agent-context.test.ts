import { EMPTY_BOARD } from "@coss/vaunt-engine/storyboard/board-schema";
import { createProject, createTextClip } from "@coss/vaunt-engine/storyboard/storyboard-factories";
import type { Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { describe, expect, it } from "vitest";
import { contextChips, describeProject, formatMoment } from "./agent-context";

const NOW = new Date("2026-11-26T12:00:00Z");

function projectWithClip(): { project: Project; clipId: string } {
  const project = createProject({ name: "Launch video", now: NOW });
  const clip = createTextClip({ text: "Ship faster", start: 1, duration: 3 });
  const [track] = project.videoTracks;
  if (!track) throw new Error("no track");
  return { project: { ...project, videoTracks: [{ ...track, clips: [clip] }] }, clipId: clip.id };
}

describe("formatMoment", () => {
  it("writes minutes, seconds and tenths", () => {
    expect(formatMoment(0)).toBe("0:00.0");
    expect(formatMoment(4.27)).toBe("0:04.2");
    expect(formatMoment(64.99)).toBe("1:04.9");
  });
});

describe("contextChips", () => {
  it("always has the project", () => {
    const project = createProject({ name: "Launch video", now: NOW });
    expect(contextChips({ project, clip: null, time: 0, playing: false })).toEqual([
      { id: "project", kind: "project", label: "Launch video" },
    ]);
  });

  it("adds the selected clip and the paused playhead", () => {
    const { project } = projectWithClip();
    const clip = project.videoTracks[0]?.clips[0] ?? null;
    const chips = contextChips({ project, clip, time: 2.36, playing: false });
    expect(chips.map((chip) => chip.label)).toEqual(["Launch video", "Ship faster", "0:02.3"]);
  });

  it("leaves the playhead out while playing, at the start, or with nothing on the timeline", () => {
    const { project } = projectWithClip();
    expect(contextChips({ project, clip: null, time: 2, playing: true })).toHaveLength(1);
    expect(contextChips({ project, clip: null, time: 0, playing: false })).toHaveLength(1);
    const empty = createProject({ name: "Empty", now: NOW });
    expect(contextChips({ project: empty, clip: null, time: 2, playing: false })).toHaveLength(1);
  });
});

describe("contextChips with a scene", () => {
  it("puts the selected scene after the project", () => {
    const project = createProject({ name: "Launch video", now: NOW });
    const scene = {
      id: "hook",
      kind: "text" as const,
      title: "Hook",
      notes: "",
      duration: 2,
      words: "Hi",
      position: { x: 0, y: 0 },
    };
    expect(
      contextChips({ project, scene, clip: null, time: 0, playing: false }).map((chip) => chip.id)
    ).toEqual(["project", "scene:hook"]);
  });
});

describe("describeProject", () => {
  it("describes an empty project", () => {
    const project = createProject({ name: "Empty", now: NOW });
    const text = describeProject(project, EMPTY_BOARD, []);
    expect(text).toContain('Project "Empty", 16:9, light theme');
    expect(text).toContain("The storyboard is empty.");
    expect(text).toContain("The timeline is empty.");
  });

  it("lists clips and the scenes, and details what the author points at", () => {
    const { project, clipId } = projectWithClip();
    const board = {
      ...EMPTY_BOARD,
      brief: "Show the booking flow",
      nodes: [
        {
          id: "hook",
          kind: "text" as const,
          title: "Hook",
          notes: "",
          duration: 2,
          words: "Ship faster",
          position: { x: 0, y: 0 },
        },
      ],
    };
    const chips = contextChips({
      project,
      clip: project.videoTracks[0]?.clips[0] ?? null,
      time: 2,
      playing: false,
    });
    const text = describeProject(project, board, chips);
    expect(text).toContain("Brief: Show the booking flow");
    expect(text).toContain("1. [text] Hook (2 s, “Ship faster”), id hook");
    expect(text).toContain('- "Ship faster", text, at 1.0 s for 3.0 s');
    expect(text).toContain(`The author is pointing at clip "Ship faster":\n{"id":"${clipId}"`);
    expect(text).toContain("The author is pointing at 0:02.0 on the timeline.");
    const pointed = describeProject(project, board, [
      { id: "scene:hook", kind: "scene", label: "Hook", nodeId: "hook" },
    ]);
    expect(pointed).toContain('The author is pointing at scene "Hook" (id hook):');
  });

  it("lists scenes in story order with what they show and the transition into the next", () => {
    const project = createProject({ name: "Order", now: NOW });
    const board = {
      brief: "",
      nodes: [
        {
          id: "ask",
          kind: "recording" as const,
          title: "Ask",
          notes: "",
          duration: 6,
          route: "/home",
          startFrom: "fresh" as const,
          position: { x: 0, y: 500 },
        },
        {
          id: "hook",
          kind: "text" as const,
          title: "Hook",
          notes: "",
          duration: 2,
          words: "Hi",
          position: { x: 0, y: 900 },
        },
      ],
      edges: [{ id: "e", from: "hook", to: "ask", transition: "crossfade" as const, transitionSeconds: 0.5 }],
    };
    expect(describeProject(project, board, [])).toContain(
      "1. [text] Hook (2 s, “Hi”), id hook; then crossfade 0.5 s\n2. [recording] Ask (6 s, /home), id ask"
    );
  });

  it("marks scenes and tracks that are locked", () => {
    const { project } = projectWithClip();
    const [track] = project.videoTracks;
    if (!track) throw new Error("no track");
    const locked: Project = {
      ...project,
      videoTracks: [
        { ...track, locked: true, clips: track.clips.map((clip) => ({ ...clip, storyboardNodeId: "hook" })) },
      ],
    };
    const board = {
      ...EMPTY_BOARD,
      nodes: [
        {
          id: "hook",
          kind: "text" as const,
          title: "Hook",
          notes: "",
          duration: 3,
          position: { x: 0, y: 0 },
          words: "Hi",
        },
      ],
    };
    const text = describeProject(locked, board, []);
    expect(text).toContain("id hook (on a locked track: don't move, retime or remove it)");
    expect(text).toContain("Video track 1 (locked):");
  });
});
