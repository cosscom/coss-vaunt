import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { RECORDING_VIDEO_FILE } from "./recording-manifest";
import { ensureRecordingVideo } from "./recording-video";

const DEFAULT_STUDIO_ROOT = path.resolve(import.meta.dirname, "../../../../.studio");

async function subdirectories(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.includes(".partial-"))
    .map((entry) => path.join(dir, entry.name));
}

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false
  );

/** Gives every recording under the studio root its playback video: `<project>/recordings/<clip>/<hash>/`. */
async function main(): Promise<void> {
  const { values } = parseArgs({ options: { root: { type: "string", default: DEFAULT_STUDIO_ROOT } } });
  let encoded = 0;
  let present = 0;
  for (const project of await subdirectories(values.root)) {
    for (const clip of await subdirectories(path.join(project, "recordings"))) {
      for (const take of await subdirectories(clip)) {
        const had = await exists(path.join(take, RECORDING_VIDEO_FILE));
        const manifest = await ensureRecordingVideo(take);
        if (!manifest?.video) continue;
        if (had) present++;
        else encoded++;
        if (!had) console.log(`encoded ${path.relative(values.root, take)}`);
      }
    }
  }
  console.log(`${encoded} encoded, ${present} already had a video`);
}

void main();
