import { readFile } from "node:fs/promises";
import path from "node:path";
import { takeCandidates } from "../project-store/project-assets";
import type { Clip, Project } from "../storyboard/storyboard-schema";
import { captureHashForClip } from "./capture-hash";
import { ensureRecordingTake } from "./link-recording-take";
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
  await ensureRecordingTake({ projectDir, clipId: clip.id, captureHash });
  const manifest = await readRecordingManifest(
    path.join(projectDir, recordingDirectory(clip.id, captureHash))
  );
  return { type: "status", captureHash, recorded: manifest ? { frameCount: manifest.frameCount } : null };
}

/** Names of the visible recording clips with no take for their current version, which an export would draw blank or stale. */
export async function unrecordedClips(project: Project, projectDir: string): Promise<string[]> {
  const clips = project.videoTracks
    .filter((track) => !track.hidden)
    .flatMap((track) => track.clips)
    .filter((clip) => clip.source.kind === "recording");
  const missing = await Promise.all(
    clips.map(async (clip) => {
      for (const captureHash of takeCandidates(project, clip)?.hashes ?? []) {
        await ensureRecordingTake({ projectDir, clipId: clip.id, captureHash });
        if (await readRecordingManifest(path.join(projectDir, recordingDirectory(clip.id, captureHash))))
          return null;
      }
      return clip.name;
    })
  );
  return missing.filter((name) => name !== null);
}
