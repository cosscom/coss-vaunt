import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { RECORDING_MANIFEST_FILE, type RecordingManifest } from "../recording/recording-manifest";
import type { ProjectScan, ScannedImport, ScannedTake } from "./project-assets";

async function entriesOf(directory: string): Promise<Dirent[]> {
  return readdir(directory, { withFileTypes: true }).catch(() => []);
}

async function readManifest(directory: string): Promise<RecordingManifest | null> {
  try {
    return JSON.parse(
      await readFile(path.join(directory, RECORDING_MANIFEST_FILE), "utf8")
    ) as RecordingManifest;
  } catch {
    return null;
  }
}

/** Reads `recordings/<clipId>/<hash>/` and `imports/` under a project folder. */
export async function scanProjectAssets(projectDir: string): Promise<ProjectScan> {
  const recordingsDir = path.join(projectDir, "recordings");
  const clipDirs = (await entriesOf(recordingsDir)).filter((entry) => entry.isDirectory());
  const takes = (
    await Promise.all(
      clipDirs.map(async (clipDir) => {
        const hashDirs = (await entriesOf(path.join(recordingsDir, clipDir.name))).filter((entry) =>
          entry.isDirectory()
        );
        return Promise.all(
          hashDirs.map(async (hashDir): Promise<ScannedTake> => {
            const directory = path.join(recordingsDir, clipDir.name, hashDir.name);
            const [manifest, info] = await Promise.all([readManifest(directory), stat(directory)]);
            return { clipId: clipDir.name, hash: hashDir.name, manifest, modifiedAt: info.mtimeMs };
          })
        );
      })
    )
  ).flat();

  const importsDir = path.join(projectDir, "imports");
  const imports = await Promise.all(
    (await entriesOf(importsDir))
      .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
      .map(async (entry): Promise<ScannedImport> => {
        const info = await stat(path.join(importsDir, entry.name));
        return { file: `imports/${entry.name}`, bytes: info.size, modifiedAt: info.mtimeMs };
      })
  );
  return { takes, imports };
}
