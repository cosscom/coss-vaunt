import type { RecordingManifest } from "@calcom/product-video/recording/recording-manifest";
import { type CursorTrack, createCursorTrack } from "@calcom/product-video/stage/cursor-track";
import type { Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { loadRecording, recordingTakesFor } from "./frame-sources/recording-lookup";

/** How long a recording clip without a manifest waits before asking again, e.g. while it is being recorded. */
const RETRY_MS = 3000;

type Entry = {
  key: string;
  hashes: string[];
  cursor: LoadedCursorTrack | null;
  loaded: boolean;
  checkedAt: number;
  /** The read in flight, so an export can wait for the cursor before drawing. */
  pending: Promise<void>;
};

export type LoadedCursorTrack = { track: CursorTrack; viewport: RecordingManifest["viewport"] };

export type CursorTracks = {
  sync: (project: Project) => void;
  /** The clip's cursor path, or null while unknown and for recordings that have none. */
  get: (clipId: string) => LoadedCursorTrack | null;
  /** Export: resolves once the clip's cursor path has been read (or found missing). */
  prepare: (clipId: string) => Promise<void>;
  /** Forgets every cursor path and reads them again for `project`. */
  refresh: (project: Project) => void;
  dispose: () => void;
};

/** Each recording clip's cursor path, read from the manifest of the take it shows. */
export function createCursorTracks({ onLoad }: { onLoad: () => void }): CursorTracks {
  const entries = new Map<string, Entry>();
  let filesUrl = "";
  let disposed = false;

  const load = (clipId: string, entry: Entry) => {
    entry.checkedAt = Date.now();
    entry.pending = loadRecording(filesUrl, clipId, entry.hashes)
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

  const tracks: CursorTracks = {
    sync(project) {
      filesUrl = `/api/projects/${encodeURIComponent(project.id)}/files`;
      const live = new Set<string>();
      for (const clip of project.videoTracks.flatMap((track) => track.clips)) {
        const takes = recordingTakesFor(project, clip);
        if (!takes) continue;
        live.add(clip.id);
        const current = entries.get(clip.id);
        if (current?.key === takes.key) {
          current.hashes = takes.hashes;
          continue;
        }
        const entry: Entry = {
          key: takes.key,
          hashes: takes.hashes,
          cursor: null,
          loaded: false,
          checkedAt: 0,
          pending: Promise.resolve(),
        };
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
    prepare: async (clipId) => {
      await entries.get(clipId)?.pending;
    },
    refresh(project) {
      entries.clear();
      tracks.sync(project);
    },
    dispose() {
      disposed = true;
      entries.clear();
    },
  };
  return tracks;
}
