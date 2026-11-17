import type { RecordingManifest } from "@calcom/product-video/recording/recording-manifest";
import { type CursorTrack, createCursorTrack } from "@calcom/product-video/stage/cursor-track";
import type { Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { loadRecording, recordingHashFor } from "./frame-sources/recording-lookup";

/** How long a recording clip without a manifest waits before asking again, e.g. while it is being recorded. */
const RETRY_MS = 3000;

type Entry = {
  hash: string;
  cursor: LoadedCursorTrack | null;
  loaded: boolean;
  checkedAt: number;
};

export type LoadedCursorTrack = { track: CursorTrack; viewport: RecordingManifest["viewport"] };

export type CursorTracks = {
  sync: (project: Project) => void;
  /** The clip's cursor path, or null while unknown and for recordings that have none. */
  get: (clipId: string) => LoadedCursorTrack | null;
  dispose: () => void;
};

/** Each recording clip's cursor path, read from the manifest of the take it shows. */
export function createCursorTracks({ onLoad }: { onLoad: () => void }): CursorTracks {
  const entries = new Map<string, Entry>();
  let filesUrl = "";
  let disposed = false;

  const load = (clipId: string, entry: Entry) => {
    entry.checkedAt = Date.now();
    void loadRecording(filesUrl, clipId, entry.hash)
      .then((recording) => {
        if (disposed || !recording || entries.get(clipId) !== entry) return;
        entry.loaded = true;
        const { manifest } = recording;
        const track = createCursorTrack(manifest.cursor, manifest.fps);
        entry.cursor = track ? { track, viewport: manifest.viewport } : null;
        if (track) onLoad();
      })
      .catch(() => undefined);
  };

  return {
    sync(project) {
      filesUrl = `/api/projects/${encodeURIComponent(project.id)}/files`;
      const live = new Set<string>();
      for (const clip of project.videoTracks.flatMap((track) => track.clips)) {
        const hash = recordingHashFor(project, clip);
        if (!hash) continue;
        live.add(clip.id);
        if (entries.get(clip.id)?.hash === hash) continue;
        const entry: Entry = { hash, cursor: null, loaded: false, checkedAt: 0 };
        entries.set(clip.id, entry);
        load(clip.id, entry);
      }
      for (const clipId of entries.keys()) if (!live.has(clipId)) entries.delete(clipId);
    },
    get(clipId) {
      const entry = entries.get(clipId);
      if (!entry) return null;
      if (!entry.loaded && Date.now() - entry.checkedAt > RETRY_MS) load(clipId, entry);
      return entry.cursor;
    },
    dispose() {
      disposed = true;
      entries.clear();
    },
  };
}
