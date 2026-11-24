import type { RecordingManifest } from "@coss/vaunt-engine/recording/recording-manifest";
import { type CursorTrack, createCursorTrack } from "@coss/vaunt-engine/stage/cursor-track";

export type LoadedCursorTrack = { track: CursorTrack; viewport: RecordingManifest["viewport"] };

const tracks = new WeakMap<RecordingManifest, LoadedCursorTrack | null>();

/** A take's cursor path, read once per manifest; null for recordings that have none. */
export function cursorTrackOf(manifest: RecordingManifest): LoadedCursorTrack | null {
  if (!tracks.has(manifest)) {
    const track = createCursorTrack(manifest.cursor, manifest.fps);
    tracks.set(manifest, track ? { track, viewport: manifest.viewport } : null);
  }
  return tracks.get(manifest) ?? null;
}
