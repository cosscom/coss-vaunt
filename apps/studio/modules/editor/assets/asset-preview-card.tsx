"use client";

import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "@coss/ui/components/preview-card";
import { frameFileName } from "@coss/vaunt-engine/recording/recording-manifest";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { formatTimecode } from "../timeline/format-timecode";
import { loopedFrame } from "./looped-frame";

/** URLs are absolute app paths; `still` is shown instead of motion when the author prefers reduced motion. */
export type PreviewMedia =
  | { kind: "video"; src: string; still: string | null }
  | { kind: "frames"; folderUrl: string; fps: number; frameCount: number; still: string | null };

const MEDIA = "aspect-[16/10] w-full rounded-md bg-black object-contain";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function VideoPreview({
  src,
  still,
  playing,
  onDuration,
}: {
  src: string;
  still: string | null;
  playing: boolean;
  onDuration: (seconds: number) => void;
}): React.ReactElement {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [playing]);
  return (
    <video
      aria-hidden="true"
      className={MEDIA}
      loop
      muted
      onLoadedMetadata={(event) => onDuration(event.currentTarget.duration)}
      playsInline
      poster={still ?? undefined}
      ref={ref}
      src={src}
    />
  );
}

/** Cycles a take's proxy frames, showing the latest one that has loaded so a slow first loop never blanks. */
function FramesPreview({
  folderUrl,
  fps,
  frameCount,
  playing,
}: {
  folderUrl: string;
  fps: number;
  frameCount: number;
  playing: boolean;
}): React.ReactElement {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!playing) return;
    const frames = Array.from({ length: frameCount }, (_, index) => {
      const image = new Image();
      image.src = `${folderUrl}/${frameFileName(index, "webp")}`;
      return image;
    });
    const started = performance.now();
    let shown = 0;
    let request = 0;
    const tick = (now: number) => {
      const index = loopedFrame(now - started, fps, frameCount);
      const frame = frames[index];
      if (index !== shown && frame?.complete && frame.naturalWidth > 0 && ref.current) {
        ref.current.src = frame.src;
        shown = index;
      }
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(request);
      for (const frame of frames) if (!frame.complete) frame.src = "";
    };
  }, [playing, folderUrl, fps, frameCount]);
  return (
    <img
      alt=""
      aria-hidden="true"
      className={MEDIA}
      ref={ref}
      src={`${folderUrl}/${frameFileName(0, "webp")}`}
    />
  );
}

function PreviewMediaView({
  media,
  playing,
  onDuration,
}: {
  media: PreviewMedia;
  playing: boolean;
  onDuration: (seconds: number) => void;
}): React.ReactElement {
  if (prefersReducedMotion()) {
    if (media.still) return <img alt="" aria-hidden="true" className={MEDIA} src={media.still} />;
    if (media.kind === "video")
      return (
        <video
          aria-hidden="true"
          className={MEDIA}
          muted
          onLoadedMetadata={(event) => onDuration(event.currentTarget.duration)}
          playsInline
          preload="metadata"
          src={`${media.src}#t=0.1`}
        />
      );
    return <FramesPreview {...media} playing={false} />;
  }
  if (media.kind === "video")
    return <VideoPreview onDuration={onDuration} playing={playing} src={media.src} still={media.still} />;
  return <FramesPreview {...media} playing={playing} />;
}

/** Hovering `trigger` shows the asset playing, muted and looped; nothing loads until the card opens. */
export function AssetPreviewCard({
  trigger,
  media,
  title,
  seconds,
}: {
  trigger: React.ReactElement;
  media: PreviewMedia;
  title: string;
  /** Null when only the file knows its length; the card reads it once the video loads. */
  seconds: number | null;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [loadedSeconds, setLoadedSeconds] = useState<number | null>(null);
  const duration = seconds ?? loadedSeconds;
  return (
    <PreviewCard onOpenChange={setOpen} open={open}>
      <PreviewCardTrigger closeDelay={0} delay={300} render={trigger} />
      <PreviewCardPopup align="start" className="w-70 flex-col gap-1.5 p-1.5" side="right" sideOffset={8}>
        <PreviewMediaView media={media} onDuration={setLoadedSeconds} playing={open} />
        <div className="flex min-w-0 items-baseline justify-between gap-2 px-1 pb-0.5 text-xs">
          <span className="truncate text-foreground">{title}</span>
          {duration !== null && Number.isFinite(duration) ? (
            <span className="shrink-0 text-muted-foreground tabular-nums">{formatTimecode(duration)}</span>
          ) : null}
        </div>
      </PreviewCardPopup>
    </PreviewCard>
  );
}
