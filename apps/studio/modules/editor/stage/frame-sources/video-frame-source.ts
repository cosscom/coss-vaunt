import { LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, VideoTexture } from "three";
import type { FrameSource } from "./frame-source";

/** Beyond this drift a playing video jumps to the clock; below it, it is nudged by playback rate. */
const HARD_RESYNC_SECONDS = 0.25;
const NUDGE_RATE = 0.06;
const MAX_SEEK_LEAD_SECONDS = 2;

/**
 * Imported footage through a muted `<video>`. Paused, it seeks exactly and reports the frame once the
 * seek lands (seeks coalesce while scrubbing); playing, it runs on its own decoder and is kept within a
 * frame of the clock, jumping ahead by the measured seek time when it falls far behind. Mipmaps are regenerated per decoded frame: a GPU blit that keeps zoomed-out
 * footage from shimmering and gives the cross-blur its mip bias.
 */
export function createVideoFrameSource({
  url,
  size,
  fps,
  maxAnisotropy,
  onFrame,
}: {
  url: string;
  size: { width: number; height: number };
  fps: number;
  maxAnisotropy: number;
  onFrame: () => void;
}): FrameSource {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  const texture = new VideoTexture(video);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = maxAnisotropy;

  let playing = false;
  let seeking = false;
  let pendingSeek: number | null = null;
  let disposed = false;
  let seekStartedAt = 0;
  let seekLead = 0;
  const frameSeconds = 1 / fps;

  const setCurrentTime = (time: number) => {
    seekStartedAt = performance.now();
    video.currentTime = time;
  };

  const seek = (time: number) => {
    if (seeking) {
      pendingSeek = time;
      return;
    }
    seeking = true;
    setCurrentTime(time);
  };

  const onSeeked = () => {
    seekLead = Math.min(MAX_SEEK_LEAD_SECONDS, (seekLead + (performance.now() - seekStartedAt) / 1000) / 2);
    seeking = false;
    const next = pendingSeek;
    pendingSeek = null;
    if (next !== null && Math.abs(next - video.currentTime) > frameSeconds / 2) seek(next);
  };

  const watchFrames = () => {
    if (disposed) return;
    video.requestVideoFrameCallback(() => {
      texture.needsUpdate = true;
      if (!playing) onFrame();
      watchFrames();
    });
  };

  video.addEventListener("seeked", onSeeked);
  watchFrames();

  return {
    texture,
    size,
    show(time, nextPlaying) {
      playing = nextPlaying;
      const end = Number.isFinite(video.duration) ? video.duration - frameSeconds : Number.POSITIVE_INFINITY;
      const target = Math.min(end, Math.max(0, time));
      if (!playing) {
        if (!video.paused) video.pause();
        video.playbackRate = 1;
        if (Math.abs(video.currentTime - target) > frameSeconds / 2 || pendingSeek !== null) seek(target);
        return;
      }
      if (video.paused) {
        if (Math.abs(video.currentTime - target) > frameSeconds) setCurrentTime(target + seekLead);
        void video.play().catch(() => undefined);
        return;
      }
      // Re-seeking before a seek lands would restart it, and a slow decoder would never catch up.
      if (video.seeking) return;
      const drift = video.currentTime - target;
      if (Math.abs(drift) > HARD_RESYNC_SECONDS) {
        setCurrentTime(target + seekLead);
        return;
      }
      video.playbackRate = Math.abs(drift) > frameSeconds ? 1 - Math.sign(drift) * NUDGE_RATE : 1;
    },
    idle() {
      playing = false;
      if (!video.paused) video.pause();
    },
    dispose() {
      disposed = true;
      video.removeEventListener("seeked", onSeeked);
      video.pause();
      video.removeAttribute("src");
      video.load();
      texture.dispose();
    },
  };
}
