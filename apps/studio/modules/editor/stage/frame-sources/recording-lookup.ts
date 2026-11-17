import { activeTakeHash } from "@calcom/product-video/project-store/project-assets";
import {
  RECORDING_MANIFEST_FILE,
  type RecordingManifest,
  recordingDirectory,
} from "@calcom/product-video/recording/recording-manifest";
import type { Clip, Project } from "@calcom/product-video/storyboard/storyboard-schema";

export type LoadedRecording = { directoryUrl: string; manifest: RecordingManifest };

/** The capture hash a recording clip's frames live under: its pinned take, or the one for the project's theme; null when it can't be recorded. */
export function recordingHashFor(project: Pick<Project, "settings">, clip: Clip): string | null {
  return activeTakeHash(project, clip);
}

export function recordingDirectoryUrl(filesUrl: string, clipId: string, captureHash: string): string {
  return `${filesUrl}/${recordingDirectory(clipId, captureHash).split("/").map(encodeURIComponent).join("/")}`;
}

/** The recording made for exactly this capture hash, or null when there isn't one yet. */
export async function loadRecording(
  filesUrl: string,
  clipId: string,
  captureHash: string
): Promise<LoadedRecording | null> {
  const directoryUrl = recordingDirectoryUrl(filesUrl, clipId, captureHash);
  const response = await fetch(`${directoryUrl}/${RECORDING_MANIFEST_FILE}`, { cache: "no-store" });
  if (!response.ok) return null;
  return { directoryUrl, manifest: (await response.json()) as RecordingManifest };
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
