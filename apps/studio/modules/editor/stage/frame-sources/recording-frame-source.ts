import { frameFileName } from "@coss/vaunt-engine/recording/recording-manifest";
import { LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Texture } from "three";
import type { FrameSource } from "./frame-source";
import type { LoadedRecording } from "./recording-lookup";
import { createVideoFrameSource } from "./video-frame-source";

/** Decoding ahead in seconds, not frames, so a 60 fps recording has as much headroom as a 30 fps one. */
const DECODE_AHEAD_SECONDS = 0.4;

/** How long the playhead rests before the lossless frame replaces the video's. */
const STILL_DELAY_MS = 150;

export function recordingFrameAt(time: number, fps: number, frameCount: number): number {
  return Math.min(frameCount - 1, Math.max(0, Math.round(time * fps)));
}

/** Mid-frame, so a seek lands on frame N whichever way the decoder rounds its timestamps. */
export function videoTimeOfFrame(frame: number, fps: number): number {
  return (frame + 0.5) / fps;
}

/**
 * A recording: its H.264 video while playing and scrubbing, then the lossless PNG once the playhead rests. Without
 * a video yet (or if it fails to load) it plays the WebP proxy frames instead.
 */
export function createRecordingFrameSource({
  recording,
  maxAnisotropy,
  onFrame,
}: {
  recording: LoadedRecording;
  maxAnisotropy: number;
  onFrame: () => void;
}): FrameSource {
  const { directoryUrl, manifest } = recording;
  if (!manifest.video) return createImageSequenceSource({ recording, maxAnisotropy, onFrame });

  const fallback: { source: FrameSource | null } = { source: null };
  const video = createVideoFrameSource({
    url: `${directoryUrl}/${manifest.video.file}`,
    size: manifest.viewport,
    fps: manifest.fps,
    maxAnisotropy,
    mipmaps: false,
    onFrame,
  });
  video.video.addEventListener("error", () => {
    fallback.source ??= createImageSequenceSource({ recording, maxAnisotropy, onFrame });
    onFrame();
  });

  const still = new Texture();
  still.colorSpace = SRGBColorSpace;
  still.generateMipmaps = true;
  still.minFilter = LinearMipmapLinearFilter;
  still.magFilter = LinearFilter;
  still.anisotropy = maxAnisotropy;
  let stillFrame = -1;
  let shownFrame = -1;
  let requestedFrame = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancelStill = () => {
    clearTimeout(timer);
    timer = undefined;
    requestedFrame = -1;
  };

  const loadStill = (frame: number) => {
    requestedFrame = frame;
    const image = new Image();
    image.src = `${directoryUrl}/frames/${frameFileName(frame, "png")}`;
    return image
      .decode()
      .then(() => {
        if (requestedFrame !== frame) return;
        still.image = image;
        still.needsUpdate = true;
        stillFrame = frame;
        shownFrame = frame;
        onFrame();
      })
      .catch(() => undefined);
  };

  return {
    get texture() {
      if (fallback.source) return fallback.source.texture;
      return shownFrame !== -1 && shownFrame === stillFrame ? still : video.texture;
    },
    size: manifest.viewport,
    show(time, playing) {
      if (fallback.source) {
        fallback.source.show(time, playing);
        return;
      }
      const frame = recordingFrameAt(time, manifest.fps, manifest.frameCount);
      video.show(playing ? time : videoTimeOfFrame(frame, manifest.fps), playing);
      if (playing) {
        cancelStill();
        shownFrame = -1;
        return;
      }
      if (frame === shownFrame || frame === requestedFrame) return;
      shownFrame = -1;
      cancelStill();
      requestedFrame = frame;
      timer = setTimeout(() => void loadStill(frame), STILL_DELAY_MS);
    },
    prepare(time) {
      if (fallback.source) return fallback.source.prepare(time);
      const frame = recordingFrameAt(time, manifest.fps, manifest.frameCount);
      if (frame === shownFrame && frame === stillFrame) return Promise.resolve();
      cancelStill();
      return loadStill(frame);
    },
    idle() {
      cancelStill();
      video.idle();
      fallback.source?.idle();
    },
    dispose() {
      cancelStill();
      video.dispose();
      still.dispose();
      fallback.source?.dispose();
    },
  };
}

/** Proxy WebP frames while playing (decoded ahead of the playhead), the lossless PNG when paused. */
function createImageSequenceSource({
  recording: { directoryUrl, manifest },
  maxAnisotropy,
  onFrame,
}: {
  recording: LoadedRecording;
  maxAnisotropy: number;
  onFrame: () => void;
}): FrameSource {
  const texture = new Texture();
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = maxAnisotropy;

  const decodeAhead = Math.ceil(DECODE_AHEAD_SECONDS * manifest.fps);
  const cachedFrames = decodeAhead * 4;
  const images = new Map<string, Promise<HTMLImageElement>>();
  let wanted = "";
  let wantedFrame = -1;
  let shown = "";
  let shownFrame = -1;
  let playing = false;

  const frameUrl = (frame: number, proxy: boolean) =>
    proxy
      ? `${directoryUrl}/proxy/${frameFileName(frame, "webp")}`
      : `${directoryUrl}/frames/${frameFileName(frame, "png")}`;

  const load = (url: string) => {
    const cached = images.get(url);
    if (cached) {
      images.delete(url);
      images.set(url, cached);
      return cached;
    }
    const image = new Image();
    image.src = url;
    const decoded = image.decode().then(() => image);
    images.set(url, decoded);
    for (const key of images.keys()) {
      if (images.size <= cachedFrames) break;
      images.delete(key);
    }
    return decoded;
  };

  return {
    texture,
    size: manifest.viewport,
    show(time, nextPlaying) {
      playing = nextPlaying;
      const proxy = playing && manifest.proxy !== null;
      const frame = Math.min(manifest.frameCount - 1, Math.max(0, Math.round(time * manifest.fps)));
      const url = frameUrl(frame, proxy);
      if (proxy) {
        for (let ahead = 1; ahead <= decodeAhead && frame + ahead < manifest.frameCount; ahead++) {
          void load(frameUrl(frame + ahead, true)).catch(() => undefined);
        }
      }
      if (url === shown || url === wanted) return;
      wanted = url;
      wantedFrame = frame;
      load(url)
        .then((image) => {
          // Playing at 60 fps asks for a new frame faster than one decodes, so a late frame still shows if it's the newest so far.
          const current = wanted === url;
          const catchingUp = proxy && playing && frame > shownFrame && frame <= wantedFrame;
          if (!current && !catchingUp) return;
          // three keeps the GPU allocation of the first upload, so a proxy drawn into a full-size texture fills one corner.
          if (texture.image instanceof HTMLImageElement && texture.image.naturalWidth !== image.naturalWidth)
            texture.dispose();
          texture.image = image;
          texture.needsUpdate = true;
          shown = url;
          shownFrame = proxy ? frame : -1;
          if (!playing) onFrame();
        })
        .catch(() => undefined);
    },
    prepare(time) {
      playing = false;
      const frame = Math.min(manifest.frameCount - 1, Math.max(0, Math.round(time * manifest.fps)));
      const url = frameUrl(frame, false);
      if (url === shown) return Promise.resolve();
      wanted = url;
      wantedFrame = frame;
      return load(url)
        .then((image) => {
          if (wanted !== url) return;
          if (texture.image instanceof HTMLImageElement && texture.image.naturalWidth !== image.naturalWidth)
            texture.dispose();
          texture.image = image;
          texture.needsUpdate = true;
          shown = url;
          shownFrame = -1;
        })
        .catch(() => undefined);
    },
    idle() {
      playing = false;
    },
    dispose() {
      images.clear();
      texture.dispose();
    },
  };
}
