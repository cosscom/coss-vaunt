import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProject, createRecordingClip } from "../storyboard/storyboard-factories";
import type { Clip, Project } from "../storyboard/storyboard-schema";
import { captureHashesForClip } from "./capture-hash";
import { RECORDING_MANIFEST_FILE, recordingDirectory } from "./recording-manifest";
import { unrecordedClips } from "./recording-status";

const recording = (id: string, name: string): Clip => ({
  ...createRecordingClip({ name, route: "/home", duration: 2 }),
  id,
});

describe("unrecordedClips", () => {
  let projectDir: string;
  beforeEach(async () => {
    projectDir = await mkdtemp(path.join(tmpdir(), "product-video-status-"));
  });
  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  const writeTake = async (clipId: string, hash: string) => {
    const directory = path.join(projectDir, recordingDirectory(clipId, hash));
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, RECORDING_MANIFEST_FILE), "{}");
  };

  it("names the visible clips with no take for their current version, at any DPR", async () => {
    const base = createProject({ name: "Status", now: new Date(Date.UTC(2026, 10, 19)) });
    const recorded = recording("a", "Recorded");
    const stale = recording("b", "Edited since");
    const hidden = recording("c", "Hidden");
    const project: Project = {
      ...base,
      videoTracks: [
        { ...base.videoTracks[0], clips: [recorded, { ...stale, start: 3, duration: 3 }] },
        { ...base.videoTracks[0], id: "t2", hidden: true, clips: [hidden] },
      ],
    };
    const [, sharper] = captureHashesForClip({ project, clip: recorded });
    await writeTake("a", sharper);
    await writeTake("b", "0123456789abcdef");
    expect(await unrecordedClips(project, projectDir)).toEqual(["Edited since"]);
  });
});
