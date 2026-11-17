import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Clip, Project } from "../storyboard/storyboard-schema";
import { captureHashForClip } from "./capture-hash";
import type { RecordingStatusEvent } from "./recording-events";
import { RECORDING_MANIFEST_FILE, type RecordingManifest, recordingDirectory } from "./recording-manifest";

export function findClip(project: Project, clipId: string): Clip | null {
  for (const track of project.videoTracks) {
    const clip = track.clips.find((candidate) => candidate.id === clipId);
    if (clip) return clip;
  }
  return null;
}

export async function readRecordingManifest(directory: string): Promise<RecordingManifest | null> {
  try {
    return JSON.parse(
      await readFile(path.join(directory, RECORDING_MANIFEST_FILE), "utf8")
    ) as RecordingManifest;
  } catch {
    return null;
  }
}

/** Whether the clip as it is now has a finished recording in the project folder. */
export async function recordingStatus({
  project,
  clip,
  theme,
  projectDir,
}: {
  project: Project;
  clip: Clip;
  theme: "light" | "dark";
  projectDir: string;
}): Promise<RecordingStatusEvent> {
  const captureHash = captureHashForClip({ project, clip, theme });
  const manifest = await readRecordingManifest(
    path.join(projectDir, recordingDirectory(clip.id, captureHash))
  );
  return { type: "status", captureHash, recorded: manifest ? { frameCount: manifest.frameCount } : null };
}
