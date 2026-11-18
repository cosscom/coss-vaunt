import { takeCandidates } from "@calcom/product-video/project-store/project-assets";
import {
  RECORDING_MANIFEST_FILE,
  type RecordingManifest,
  recordingDirectory,
} from "@calcom/product-video/recording/recording-manifest";
import type { Clip, Project } from "@calcom/product-video/storyboard/storyboard-schema";

export type LoadedRecording = { directoryUrl: string; manifest: RecordingManifest; hash: string };

/** The takes a recording clip can show, best first, under a key that zoom edits don't change; null when it can't be recorded. */
export type RecordingTakes = { key: string; hashes: string[] };

export function recordingTakesFor(project: Pick<Project, "settings">, clip: Clip): RecordingTakes | null {
  return takeCandidates(project, clip);
}

export function recordingDirectoryUrl(filesUrl: string, clipId: string, captureHash: string): string {
  return `${filesUrl}/${recordingDirectory(clipId, captureHash).split("/").map(encodeURIComponent).join("/")}`;
}

/** The first of `hashes` the clip has a recording for, or null when there isn't one yet. */
export async function loadRecording(
  filesUrl: string,
  clipId: string,
  hashes: readonly string[]
): Promise<LoadedRecording | null> {
  for (const hash of hashes) {
    const directoryUrl = recordingDirectoryUrl(filesUrl, clipId, hash);
    const response = await fetch(`${directoryUrl}/${RECORDING_MANIFEST_FILE}`, { cache: "no-store" });
    if (response.ok) return { directoryUrl, manifest: (await response.json()) as RecordingManifest, hash };
  }
  return null;
}

/** Asks the studio to make a recording's playback video; the updated recording once it has one, else null. */
export async function requestRecordingVideo(
  projectUrl: string,
  recording: LoadedRecording,
  clipId: string,
  captureHash: string
): Promise<LoadedRecording | null> {
  const response = await fetch(`${projectUrl}/clips/${encodeURIComponent(clipId)}/recording-video`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ captureHash }),
  });
  if (!response.ok) return null;
  const { manifest } = (await response.json()) as { manifest: RecordingManifest };
  return manifest.video ? { ...recording, manifest } : null;
}
