import { frameFileName } from "@calcom/product-video/recording/recording-manifest";
import { LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Texture } from "three";
import type { FrameSource } from "./frame-source";
import type { LoadedRecording } from "./recording-lookup";

const DECODE_AHEAD_FRAMES = 12;
const CACHED_FRAMES = 48;

/**
 * A recorded image sequence: proxy WebP frames while playing (decoded ahead of the playhead), the
 * lossless PNG when paused.
 */
export function createRecordingFrameSource({
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

  const images = new Map<string, Promise<HTMLImageElement>>();
  let wanted = "";
  let shown = "";
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
      if (images.size <= CACHED_FRAMES) break;
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
        for (let ahead = 1; ahead <= DECODE_AHEAD_FRAMES && frame + ahead < manifest.frameCount; ahead++) {
          void load(frameUrl(frame + ahead, true)).catch(() => undefined);
        }
      }
      if (url === shown || url === wanted) return;
      wanted = url;
      load(url)
        .then((image) => {
          if (wanted !== url) return;
          texture.image = image;
          texture.needsUpdate = true;
          shown = url;
          if (!playing) onFrame();
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
