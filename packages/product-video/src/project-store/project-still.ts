import { frameFileName, recordingDirectory } from "../recording/recording-manifest";
import type { Project } from "../storyboard/storyboard-schema";
import { activeTakeHash, type ProjectScan, type ScannedTake } from "./project-assets";
import { scanProjectAssets } from "./scan-project-assets";

/** A frame for the project's card: a project-relative image, or a video file and the second to show. */
export type ProjectStill = { kind: "image"; file: string } | { kind: "video"; file: string; time: number };

function takeStill(take: ScannedTake): ProjectStill | null {
  const manifest = take.manifest;
  if (!manifest || manifest.frameCount === 0) return null;
  const folder = recordingDirectory(take.clipId, take.hash);
  // The middle of the take: its first frames are often a blank page still loading.
  const middle = Math.floor(manifest.frameCount / 2);
  return manifest.proxy
    ? { kind: "image", file: `${folder}/proxy/${frameFileName(middle, "webp")}` }
    : { kind: "image", file: `${folder}/frames/${frameFileName(middle)}` };
}

/**
 * The first media on the project's visible tracks, by start time: a recording's take (the one it shows,
 * else its newest), an image, or the middle of an imported video. Null when the project has only text.
 */
export function pickProjectStill(project: Project, scan: ProjectScan): ProjectStill | null {
  const clips = project.videoTracks
    .filter((track) => !track.hidden)
    .flatMap((track) => track.clips)
    .sort((a, b) => a.start - b.start);
  for (const clip of clips) {
    const { source } = clip;
    if (source.kind === "image") return { kind: "image", file: source.file };
    if (source.kind === "import")
      return { kind: "video", file: source.file, time: source.trimStart + clip.duration / 2 };
    if (source.kind !== "recording") continue;
    const active = activeTakeHash(project, clip);
    const takes = scan.takes
      .filter((take) => take.clipId === clip.id && take.manifest)
      .sort((a, b) => Number(b.hash === active) - Number(a.hash === active) || b.modifiedAt - a.modifiedAt);
    const still = takes.map(takeStill).find((candidate) => candidate !== null);
    if (still) return still;
  }
  return null;
}

export async function findProjectStill(projectDir: string, project: Project): Promise<ProjectStill | null> {
  return pickProjectStill(project, await scanProjectAssets(projectDir));
}
