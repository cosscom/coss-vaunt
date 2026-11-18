import { access, copyFile, link, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
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

const linking = new Map<string, Promise<boolean>>();

async function hasManifest(directory: string): Promise<boolean> {
  return access(path.join(directory, RECORDING_MANIFEST_FILE)).then(
    () => true,
    () => false
  );
}

/**
 * Makes sure `clipId` has its take for `captureHash`, linking it from another clip that recorded the same
 * hash: a duplicated or pasted recording clip captures the same pixels under a new id. False when no clip has it.
 */
export function ensureRecordingTake({
  projectDir,
  clipId,
  captureHash,
}: {
  projectDir: string;
  clipId: string;
  captureHash: string;
}): Promise<boolean> {
  const directory = path.join(projectDir, recordingDirectory(clipId, captureHash));
  const pending = linking.get(directory);
  if (pending) return pending;
  const run = (async () => {
    if (await hasManifest(directory)) return true;
    const clips = await readdir(path.join(projectDir, "recordings"), { withFileTypes: true }).catch(() => []);
    for (const other of clips) {
      if (!other.isDirectory() || other.name === clipId) continue;
      if (!(await hasManifest(path.join(projectDir, recordingDirectory(other.name, captureHash))))) continue;
      return linkRecordingTake({ projectDir, fromClipId: other.name, toClipId: clipId, captureHash });
    }
    return false;
  })().finally(() => linking.delete(directory));
  linking.set(directory, run);
  return run;
}
