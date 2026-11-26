import { mediaTypeOf } from "../imports/media-types";
import { captureContentKey, captureHashesForClip, captureHashForClip } from "../recording/capture-hash";
import { frameFileName, type RecordingManifest, recordingDirectory } from "../recording/recording-manifest";
import type { AudioClip, Clip, Project } from "../storyboard/storyboard-schema";

/** One recording folder on disk, before it is matched to the project. */
export type ScannedTake = {
  clipId: string;
  hash: string;
  manifest: RecordingManifest | null;
  modifiedAt: number;
};
export type ScannedImport = { file: string; bytes: number; modifiedAt: number };
export type ProjectScan = { takes: ScannedTake[]; imports: ScannedImport[] };

/** What the assets pane plays on hover: the take's MP4 proxy, else its WebP proxy frames. Paths are project-relative. */
export type TakePreview = { kind: "video"; file: string } | { kind: "frames"; folder: string };

export type AssetTake = {
  hash: string;
  theme: RecordingManifest["theme"] | null;
  frameCount: number;
  fps: number;
  modifiedAt: number;
  /** Project-relative first frame; null while the take has no manifest (still recording, or failed). */
  thumbnail: string | null;
  preview: TakePreview | null;
  /** The take the clip shows now. */
  active: boolean;
  /** The clip showing this take, to drop on the timeline; null once the clip is deleted or the take is unfinished. */
  template: AssetTemplate | null;
};

export type RecordingAsset = {
  clipId: string;
  /** Null when the clip was deleted and only its recordings are left. */
  name: string | null;
  storyboardNodeId: string | null;
  takes: AssetTake[];
};

/** What dropping the asset on the timeline adds, copied from a clip that already uses the file. */
export type AssetTemplate = { kind: "video"; clip: Clip } | { kind: "audio"; clip: AudioClip };

export type FileAsset = {
  file: string;
  kind: "video" | "image" | "audio";
  name: string;
  bytes: number;
  modifiedAt: number;
  /** Null until a file no clip uses has been probed for its size and length, or when it can't be read. */
  template: AssetTemplate | null;
};

export type TextAsset = { clipId: string; name: string; text: string; template: AssetTemplate };

export type ProjectAssets = { recordings: RecordingAsset[]; files: FileAsset[]; texts: TextAsset[] };

/** The take a recording clip shows: the one it pinned, or the one matching its current script. */
export function activeTakeHash(
  project: Parameters<typeof captureHashForClip>[0]["project"],
  clip: Clip
): string | null {
  if (clip.source.kind !== "recording") return null;
  if (clip.source.take) return clip.source.take;
  try {
    return captureHashForClip({ project, clip });
  } catch {
    return null;
  }
}

type TakeCandidates = { key: string; hashes: string[] };

/** The recording clips `clip` continues from, nearest first; null when the chain is broken or loops. */
function startChain(videoTracks: Project["videoTracks"] | undefined, clip: Clip): Clip[] | null {
  const chain: Clip[] = [];
  const seen = new Set([clip.id]);
  let next = clip.source.kind === "recording" ? clip.source.startFrom?.clipId : undefined;
  while (next) {
    if (seen.has(next) || !videoTracks) return null;
    seen.add(next);
    const id = next;
    const previous = videoTracks.flatMap((track) => track.clips).find((candidate) => candidate.id === id);
    if (!previous || previous.source.kind !== "recording") return null;
    chain.push(previous);
    next = previous.source.startFrom?.clipId;
  }
  return chain;
}

/**
 * Hashing a script takes a while and edits keep unchanged clips as the same objects, so each clip's candidates
 * are kept while it, the project settings and the clips it continues from stay the same.
 */
const candidatesCache = new WeakMap<
  Clip,
  { settings: Project["settings"]; chain: Clip[]; result: TakeCandidates | null }
>();

/**
 * The takes a recording clip can show, best first, and a key that ignores DPR: its pinned take, else its
 * script's capture hash at the DPR it needs and then at other DPRs. Null for clips that can't be recorded.
 */
export function takeCandidates(
  project: Parameters<typeof captureHashForClip>[0]["project"],
  clip: Clip
): TakeCandidates | null {
  if (clip.source.kind !== "recording") return null;
  if (clip.source.take) return { key: `take:${clip.source.take}`, hashes: [clip.source.take] };
  const chain = startChain(project.videoTracks, clip);
  const cached = candidatesCache.get(clip);
  if (
    chain &&
    cached &&
    cached.settings === project.settings &&
    cached.chain.length === chain.length &&
    cached.chain.every((previous, index) => previous === chain[index])
  )
    return cached.result;
  let result: TakeCandidates | null;
  try {
    result = { key: captureContentKey({ project, clip }), hashes: captureHashesForClip({ project, clip }) };
  } catch {
    result = null;
  }
  if (chain) candidatesCache.set(clip, { settings: project.settings, chain, result });
  return result;
}

/** The `take` to store when the author picks `hash`: none when it is the take the script already produces. */
export function pinnedTakeFor(
  project: Parameters<typeof captureHashForClip>[0]["project"],
  clip: Clip,
  hash: string
): string | undefined {
  if (clip.source.kind !== "recording") return undefined;
  const scripted = activeTakeHash(project, { ...clip, source: { ...clip.source, take: undefined } });
  return hash === scripted ? undefined : hash;
}

function displayName(file: string): string {
  const base = file.split("/").pop() ?? file;
  return base.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "");
}

function thumbnailFor(take: ScannedTake): string | null {
  if (!take.manifest) return null;
  const folder = recordingDirectory(take.clipId, take.hash);
  return take.manifest.proxy
    ? `${folder}/proxy/${frameFileName(0, "webp")}`
    : `${folder}/frames/${frameFileName(0)}`;
}

function previewFor(take: ScannedTake): TakePreview | null {
  if (!take.manifest) return null;
  const folder = recordingDirectory(take.clipId, take.hash);
  if (take.manifest.video) return { kind: "video", file: `${folder}/${take.manifest.video.file}` };
  return take.manifest.proxy ? { kind: "frames", folder: `${folder}/proxy` } : null;
}

/** Groups what is on disk by the clip that owns it, newest take first. */
export function listProjectAssets(project: Project, scan: ProjectScan): ProjectAssets {
  const clips = project.videoTracks.flatMap((track) => track.clips);
  const audioClips = project.audioTracks.flatMap((track) => track.clips);
  const clipById = new Map(clips.map((clip) => [clip.id, clip]));

  const takesByClip = new Map<string, ScannedTake[]>();
  for (const take of scan.takes)
    takesByClip.set(take.clipId, [...(takesByClip.get(take.clipId) ?? []), take]);
  const recordings = [...takesByClip.entries()].map(([clipId, takes]): RecordingAsset => {
    const clip = clipById.get(clipId);
    const active = clip ? activeTakeHash(project, clip) : null;
    return {
      clipId,
      name: clip?.name ?? null,
      storyboardNodeId: clip?.storyboardNodeId ?? null,
      takes: [...takes]
        .sort((a, b) => b.modifiedAt - a.modifiedAt)
        .map((take) => ({
          hash: take.hash,
          theme: take.manifest?.theme ?? null,
          frameCount: take.manifest?.frameCount ?? 0,
          fps: take.manifest?.fps ?? project.settings.fps,
          modifiedAt: take.modifiedAt,
          thumbnail: thumbnailFor(take),
          preview: previewFor(take),
          active: take.hash === active,
          template:
            clip?.source.kind === "recording" && take.manifest
              ? { kind: "video", clip: { ...clip, source: { ...clip.source, take: take.hash } } }
              : null,
        })),
    };
  });
  const clipOrder = new Map(clips.map((clip, index) => [clip.id, index]));
  recordings.sort(
    (a, b) =>
      (clipOrder.get(a.clipId) ?? Number.POSITIVE_INFINITY) -
      (clipOrder.get(b.clipId) ?? Number.POSITIVE_INFINITY)
  );

  const files = scan.imports
    .map((entry): FileAsset | null => {
      const kind = mediaTypeOf(entry.file, "")?.kind;
      if (!kind) return null;
      const videoClip = clips.find(
        (clip) =>
          (clip.source.kind === "import" || clip.source.kind === "image") && clip.source.file === entry.file
      );
      const audioClip = audioClips.find((clip) => clip.file === entry.file);
      const template: AssetTemplate | null = videoClip
        ? { kind: "video", clip: videoClip }
        : audioClip
          ? { kind: "audio", clip: audioClip }
          : null;
      return { ...entry, kind, name: displayName(entry.file), template };
    })
    .filter((asset): asset is FileAsset => asset !== null)
    .sort((a, b) => b.modifiedAt - a.modifiedAt);

  const texts = clips.flatMap((clip): TextAsset[] =>
    clip.source.kind === "text"
      ? [{ clipId: clip.id, name: clip.name, text: clip.source.text, template: { kind: "video", clip } }]
      : []
  );

  return { recordings, files, texts };
}
