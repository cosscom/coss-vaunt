import type { Texture } from "three";

/**
 * What a device plane shows: a texture that holds the clip's frame at the time last passed to `show`.
 * Sources call their `onFrame` callback when a new frame lands while paused, so the stage redraws.
 */
export type FrameSource = {
  texture: Texture;
  /** Pixel size of a frame, which sets the device plane's aspect ratio. */
  size: { width: number; height: number };
  /** Brings the texture to `time` seconds into the source; `playing` picks smooth over exact. */
  show: (time: number, playing: boolean) => void;
  /** Export: holds exactly the frame for `time` at full quality, resolving once the texture has it. */
  prepare: (time: number) => Promise<void>;
  /** The clip is off screen: stop decoding. */
  idle: () => void;
  dispose: () => void;
};
