export type Rect = { x: number; y: number; width: number; height: number };

export type CursorSample = { x: number; y: number; pressed: boolean; visible: boolean };

/**
 * Written as `manifest.json` beside a recording's frames, at
 * `.studio/<projectId>/recordings/<clipId>/<captureHash>/`. Frames are `frames/<6-digit index>.png`,
 * `viewport × dpr` pixels; every coordinate here is in CSS pixels of the viewport.
 */
export type RecordingManifest = {
  version: 1;
  clipId: string;
  /** Hash of the fields that affect what gets captured; camera, text and audio edits don't change it. */
  captureHash: string;
  theme: "light" | "dark";
  fps: number;
  frameCount: number;
  viewport: { width: number; height: number };
  dpr: number;
  /** One sample per frame. */
  cursor: CursorSample[];
  /** The clip's `focus` selector resolved per frame, or null where it isn't on screen. */
  focus: Array<Rect | null>;
  /** Smaller frames for smooth playback in the editor, at `proxy/<6-digit index>.webp`. */
  proxy: { dpr: number } | null;
  /** One H.264 file at viewport size and the recording's fps, frame N at N/fps, for playback and scrubbing; absent on older recordings until backfilled. */
  video?: { file: string; width: number; height: number } | null;
};

export const RECORDING_MANIFEST_FILE = "manifest.json";
export const RECORDING_VIDEO_FILE = "proxy.mp4";

export function frameFileName(frame: number, extension: "png" | "webp" = "png"): string {
  return `${String(frame).padStart(6, "0")}.${extension}`;
}

/** Project-relative folder of one recording, as served by the studio's file route. */
export function recordingDirectory(clipId: string, captureHash: string): string {
  return `recordings/${clipId}/${captureHash}`;
}
