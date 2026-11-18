import { copyFile, link, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { RECORDING_MANIFEST_FILE, type RecordingManifest, recordingDirectory } from "./recording-manifest";

async function linkTree(from: string, to: string): Promise<void> {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) await linkTree(source, target);
    else if (entry.name !== RECORDING_MANIFEST_FILE)
      await link(source, target).catch(() => copyFile(source, target));
  }
}

/**
 * Gives `toClipId` a take `fromClipId` recorded, so a take dragged from the assets pane plays on its new
 * clip: recordings live under their clip's id. Frames are hard links, so the copy costs no disk.
 * False when the take has no manifest.
 */
export async function linkRecordingTake({
  projectDir,
  fromClipId,
  toClipId,
  captureHash,
}: {
  projectDir: string;
  fromClipId: string;
  toClipId: string;
  captureHash: string;
}): Promise<boolean> {
  const from = path.join(projectDir, recordingDirectory(fromClipId, captureHash));
  const to = path.join(projectDir, recordingDirectory(toClipId, captureHash));
  let manifest: RecordingManifest;
  try {
    manifest = JSON.parse(
      await readFile(path.join(from, RECORDING_MANIFEST_FILE), "utf8")
    ) as RecordingManifest;
  } catch {
    return false;
  }
  await rm(to, { recursive: true, force: true });
  await linkTree(from, to);
  // Written last: a manifest marks the take as complete.
  await writeFile(
    path.join(to, RECORDING_MANIFEST_FILE),
    `${JSON.stringify({ ...manifest, clipId: toClipId }, null, 2)}\n`
  );
  return true;
}
