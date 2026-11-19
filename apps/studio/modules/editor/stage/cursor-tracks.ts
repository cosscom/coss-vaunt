import type { RecordingManifest } from "@calcom/product-video/recording/recording-manifest";
import { type CursorTrack, createCursorTrack } from "@calcom/product-video/stage/cursor-track";

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
