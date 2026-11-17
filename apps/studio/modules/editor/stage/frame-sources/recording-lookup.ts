import { captureHashForClip } from "@calcom/product-video/recording/capture-hash";
import {
  RECORDING_MANIFEST_FILE,
  type RecordingManifest,
  recordingDirectory,
} from "@calcom/product-video/recording/recording-manifest";
import type { Clip, Project } from "@calcom/product-video/storyboard/storyboard-schema";

export type LoadedRecording = { directoryUrl: string; manifest: RecordingManifest };

/** The capture hash a recording clip's frames live under for the project's theme; null when it can't be recorded. */
export function recordingHashFor(project: Pick<Project, "settings">, clip: Clip): string | null {
  if (clip.source.kind !== "recording") return null;
  try {
    return captureHashForClip({ project, clip });
  } catch {
    return null;
  }
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
