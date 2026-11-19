import { takeCandidates } from "@calcom/product-video/project-store/project-assets";
import {
  RECORDING_MANIFEST_FILE,
  type RecordingManifest,
  recordingDirectory,
} from "@calcom/product-video/recording/recording-manifest";
import type { Clip, Project } from "@calcom/product-video/storyboard/storyboard-schema";

export type LoadedRecording = { directoryUrl: string; manifest: RecordingManifest; hash: string };

/** A take's folder name; skips the `.partial-<pid>` folders of recordings still being written. */
const CAPTURE_HASH = /^[0-9a-f]{16}$/;

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

/**
 * The clip's newest take on disk, whatever version of the clip it was recorded for: what the stage shows while
 * the current version has no take, instead of a blank frame. Null when the clip was never recorded.
 */
export async function loadLatestRecording(filesUrl: string, clipId: string): Promise<LoadedRecording | null> {
  const response = await fetch(`${filesUrl}/recordings/${encodeURIComponent(clipId)}`, { cache: "no-store" });
  if (!response.ok) return null;
  const { entries } = (await response.json()) as { entries: Array<{ name: string; directory: boolean }> };
  const takes = entries.filter((entry) => entry.directory && CAPTURE_HASH.test(entry.name));
  return loadRecording(
    filesUrl,
    clipId,
    takes.map((entry) => entry.name)
  );
}

/** The takes worth asking for: every candidate until the clip shows one of them, then only the best. */
export function wantedTakes(hashes: readonly string[], shown: string | null): string[] {
  const [best] = hashes;
  if (!best || shown === best) return [];
  return shown !== null && hashes.includes(shown) ? [best] : [...hashes];
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
