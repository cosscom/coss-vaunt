"use client";

import { audioClipGainAt } from "@calcom/product-video/audio/audio-volume";
import type { AudioClip } from "@calcom/product-video/storyboard/storyboard-schema";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { AUDIO_COPY } from "../../audio/audio-copy";
import type { PlaybackClock } from "../../player/playback-clock";
import type { AudioDragMode } from "./audio-drag";
import { AUDIO_CLIP_INNER_HEIGHT_PX, VOLUME_LINE_GRAB_PX } from "./audio-metrics";
import { AudioWaveform } from "./audio-waveform";
import { useWaveformPeaks } from "./use-waveform-peaks";
import { volumeLineY } from "./volume-curve";

const copy = AUDIO_COPY.clip;
/** Narrower clips keep only their trim handles, so the fade handles don't cover them. */
const MIN_FADE_HANDLES_WIDTH_PX = 40;

type AudioClipBlockProps = {
  clip: AudioClip;
  projectId: string;
  left: number;
  width: number;
  pxPerSecond: number;
  selected: boolean;
  muted: boolean;
  clock: PlaybackClock;
  onPointerDown: (event: React.PointerEvent, mode: AudioDragMode) => void;
  onSelect: () => void;
};

function EdgeHandle({
  edge,
  onPointerDown,
}: {
  edge: "start" | "end";
  onPointerDown: (event: React.PointerEvent) => void;
}): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute inset-y-0 z-3 flex w-2 cursor-ew-resize touch-none items-center justify-center opacity-0 transition-opacity group-hover/audio:opacity-100 group-data-selected/audio:opacity-100",
        edge === "start" ? "start-0" : "end-0"
      )}
      data-testid={`audio-trim-${edge}`}
      onPointerDown={onPointerDown}>
      <span className="h-4 w-0.5 rounded-full bg-(--studio-audio-line)" />
    </div>
  );
}

function FadeHandle({
  side,
  offset,
  onPointerDown,
}: {
  side: "in" | "out";
  offset: number;
  onPointerDown: (event: React.PointerEvent) => void;
}): React.ReactElement {
  const inset = Math.max(6, offset);
  return (
    <div
      aria-hidden="true"
      className="absolute top-0 z-4 flex size-4 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center opacity-0 transition-opacity group-hover/audio:opacity-100 group-data-selected/audio:opacity-100"
      data-testid={`audio-fade-${side}`}
      onPointerDown={onPointerDown}
      style={side === "in" ? { left: inset } : { left: `calc(100% - ${inset}px)` }}>
      <span className="size-2 rounded-full border border-background bg-(--studio-audio-line) shadow-xs" />
    </div>
  );
}

export function AudioClipBlock({
  clip,
  projectId,
  left,
  width,
  pxPerSecond,
  selected,
  muted,
  clock,
  onPointerDown,
  onSelect,
}: AudioClipBlockProps): React.ReactElement {
  const peaks = useWaveformPeaks(projectId, clip.file);
  const keyframed = clip.volume.keyframes.length > 0;

  const nearVolumeLine = (event: React.PointerEvent<HTMLElement>) => {
    if (keyframed) return false;
    const box = event.currentTarget.getBoundingClientRect();
    const local = (event.clientX - box.left) / pxPerSecond;
    const lineY = volumeLineY(audioClipGainAt(clip, local), AUDIO_CLIP_INNER_HEIGHT_PX) + 1;
    return Math.abs(event.clientY - box.top - lineY) <= VOLUME_LINE_GRAB_PX;
  };

  return (
    <div
      className="group/audio absolute inset-y-1.5"
      data-audio-clip-id={clip.id}
      data-selected={selected ? "" : undefined}
      data-testid="audio-clip"
      style={{ left, width }}>
      <button
        aria-label={`${clip.name}, ${copy.seconds(clip.duration)}`}
        aria-pressed={selected}
        className={cn(
          "relative flex size-full cursor-grab touch-none select-none items-start overflow-hidden rounded-md border border-(--studio-audio)/40 bg-(--studio-audio)/14 px-2 py-1 text-start outline-none transition-colors hover:bg-(--studio-audio)/20 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
          selected && "border-(--studio-audio) bg-(--studio-audio)/22 ring-(--studio-audio) ring-1",
          muted && "opacity-48"
        )}
        onClick={(event) => {
          if (event.detail === 0) onSelect();
        }}
        onPointerDown={(event) => onPointerDown(event, nearVolumeLine(event) ? "volume" : "move")}
        onPointerMove={(event) => {
          event.currentTarget.style.cursor = nearVolumeLine(event) ? "ns-resize" : "";
        }}
        type="button">
        <AudioWaveform
          clip={clip}
          clock={clock}
          height={AUDIO_CLIP_INNER_HEIGHT_PX}
          peaks={peaks}
          pxPerSecond={pxPerSecond}
          width={width - 2}
        />
        <span className="relative flex min-w-0 items-baseline gap-1.5 rounded-sm bg-background/56 px-1 leading-4 backdrop-blur-[2px]">
          <span className="min-w-0 truncate font-medium text-foreground text-xs">{clip.name}</span>
          <span className="shrink-0 text-[0.625rem] text-muted-foreground tabular-nums">
            {copy.seconds(clip.duration)}
          </span>
        </span>
      </button>
      <EdgeHandle edge="start" onPointerDown={(event) => onPointerDown(event, "trim-start")} />
      <EdgeHandle edge="end" onPointerDown={(event) => onPointerDown(event, "trim-end")} />
      {width >= MIN_FADE_HANDLES_WIDTH_PX ? (
        <>
          <FadeHandle
            offset={clip.fadeIn * pxPerSecond}
            onPointerDown={(event) => onPointerDown(event, "fade-in")}
            side="in"
          />
          <FadeHandle
            offset={clip.fadeOut * pxPerSecond}
            onPointerDown={(event) => onPointerDown(event, "fade-out")}
            side="out"
          />
        </>
      ) : null}
    </div>
  );
}
