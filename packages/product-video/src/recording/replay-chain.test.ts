import { describe, expect, it } from "vitest";
import { ROUTE_CATALOGUE } from "../catalogues/routes/route-catalogue";
import { findClip, splitClip, trimClip } from "../storyboard/storyboard-edits";
import { createProject, createRecordingClip } from "../storyboard/storyboard-factories";
import { type Clip, type Project, projectSchema } from "../storyboard/storyboard-schema";
import { captureHashForClip } from "./capture-hash";
import { replayChain } from "./replay-chain";

const recording = (id: string, startFrom?: string, text = "Book Sandy"): Clip => ({
  ...createRecordingClip({ name: id, route: "/home", duration: 4 }),
  id,
  source: {
    kind: "recording",
    route: "/home",
    actions: [{ kind: "type", at: 0.5, target: "[data-testid=ai-chat-input]", text }],
    startFrom: startFrom ? { clipId: startFrom } : undefined,
  },
});

const projectWith = (clips: Clip[]): Project => {
  const project = createProject({ name: "Demo", now: new Date("2026-11-18T08:00:00Z") });
  return { ...project, videoTracks: [{ ...project.videoTracks[0], clips }] };
};

describe("replayChain", () => {
  it("is empty for a fresh start", () => {
    expect(replayChain([], recording("a"))).toEqual([]);
  });

  it("lists every predecessor, earliest first", () => {
    const project = projectWith([
      recording("a", undefined, "one"),
      recording("b", "a", "two"),
      recording("c", "b"),
    ]);
    const chain = replayChain(project.videoTracks, recording("c", "b"));
    expect(chain.map((step) => step.actions[0])).toMatchObject([{ text: "one" }, { text: "two" }]);
  });

  it("fails on a missing predecessor or a loop", () => {
    expect(() => replayChain(projectWith([]).videoTracks, recording("b", "a"))).toThrow(/not a recording/);
    const looped = projectWith([recording("a", "b"), recording("b", "a")]);
    expect(() => replayChain(looped.videoTracks, recording("b", "a"))).toThrow(/loop/);
  });
});

describe("captureHashForClip with a predecessor", () => {
  it("keeps the hash of a clip that starts fresh", () => {
    const clip = recording("a");
    const project = projectWith([clip]);
    expect(captureHashForClip({ project, clip })).toBe(
      captureHashForClip({ project: { settings: project.settings }, clip })
    );
  });

  it("changes when the predecessor's actions change", () => {
    const next = recording("b", "a");
    const before = captureHashForClip({ project: projectWith([recording("a"), next]), clip: next });
    const after = captureHashForClip({
      project: projectWith([recording("a", undefined, "Book Sam"), next]),
      clip: next,
    });
    expect(after).not.toBe(before);
  });
});

describe("captureHashForClip after timeline edits", () => {
  const hashes = (project: Project) =>
    ["a", "b"].map((id) => {
      const clip = findClip(project, id);
      return clip && captureHashForClip({ project, clip });
    });
  const pair = () => projectWith([recording("a"), { ...recording("b", "a"), start: 4 }]);

  it("keeps the clip's take and its follower's when its end is trimmed shorter, even past an action", () => {
    const trimmed = trimClip(pair(), "a", "end", 0.4);
    expect(findClip(trimmed, "a")?.duration).toBeCloseTo(0.4);
    expect(hashes(trimmed)).toEqual(hashes(pair()));
  });

  it("needs new takes once the clip outgrows the length it was captured at", () => {
    const extended = trimClip(trimClip(pair(), "a", "end", 3.9), "a", "end", 4.1);
    expect(findClip(extended, "a")?.duration).toBeCloseTo(4.1);
    expect(hashes(extended)[0]).not.toBe(hashes(pair())[0]);
    expect(hashes(extended)[1]).not.toBe(hashes(pair())[1]);
  });

  it("gives the tail only the actions it shows when a trimmed clip is split", () => {
    const split = splitClip(trimClip(pair(), "a", "end", 0.4), "a", 0.2);
    const tail = split && findClip(split.project, split.clipId);
    expect(tail?.source).toMatchObject({ actions: [] });
    expect(split && projectSchema.safeParse(split.project).success).toBe(true);
  });

  it("keeps the head's take when a clip is split, even before an action", () => {
    const split = splitClip(pair(), "a", 0.3);
    expect(split && hashes(split.project)).toEqual(hashes(pair()));
  });
});

describe("captureHashForClip and the route catalogue", () => {
  it("records any app path with the default entry", () => {
    const clip = {
      ...recording("a"),
      source: { kind: "recording" as const, route: "/settings/my-account/profile", actions: [] },
    };
    expect(captureHashForClip({ project: projectWith([clip]), clip })).toMatch(/^[0-9a-f]{16}$/);
  });

  it("ignores catalogue targets and descriptions, which only guide planning", () => {
    const clip = recording("a");
    const project = projectWith([clip]);
    const before = captureHashForClip({ project, clip });
    const home = ROUTE_CATALOGUE[0];
    const saved = { targets: home.targets, description: home.description };
    home.targets = [...home.targets, { name: "new", selector: "#new", description: "A new target" }];
    home.description = "Edited";
    try {
      expect(captureHashForClip({ project, clip })).toBe(before);
    } finally {
      Object.assign(home, saved);
    }
  });
});
