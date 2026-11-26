"use client";

import { LockIcon, MusicIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import { audioClipGainAt } from "@coss/vaunt-engine/audio/audio-volume";
import type { AudioClip } from "@coss/vaunt-engine/storyboard/storyboard-schema";
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
  /** On a locked track: drawn muted and out of reach of the pointer, keyboard and menus. */
  locked?: boolean;
  clock: PlaybackClock;
  onPointerDown: (event: React.PointerEvent, mode: AudioDragMode) => void;
  onSelect: () => void;
  /** The clip's inner height, from its track's height. */
  innerHeight?: number;
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
  locked = false,
  clock,
  onPointerDown,
  onSelect,
  innerHeight = AUDIO_CLIP_INNER_HEIGHT_PX,
}: AudioClipBlockProps): React.ReactElement {
  const peaks = useWaveformPeaks(projectId, clip.file);
  const keyframed = clip.volume.keyframes.length > 0;

  const nearVolumeLine = (event: React.PointerEvent<HTMLElement>) => {
    if (keyframed) return false;
    const box = event.currentTarget.getBoundingClientRect();
    const local = (event.clientX - box.left) / pxPerSecond;
    const lineY = volumeLineY(audioClipGainAt(clip, local), innerHeight) + 1;
    return Math.abs(event.clientY - box.top - lineY) <= VOLUME_LINE_GRAB_PX;
  };

  return (
    <div
      className={cn("group/audio absolute inset-y-1.5", locked && "pointer-events-none")}
      data-audio-clip-id={clip.id}
      data-locked={locked ? "" : undefined}
      inert={locked}
      data-selected={selected ? "" : undefined}
      data-testid="audio-clip"
      style={{ left, width }}>
      <button
        aria-label={`${clip.name}, ${copy.seconds(clip.duration)}`}
        aria-pressed={selected}
        className={cn(
          "relative flex size-full cursor-grab touch-none select-none flex-col items-start justify-between overflow-hidden rounded-md border border-(--studio-audio)/40 bg-(--studio-audio)/14 px-2 py-1.5 text-start outline-none transition-colors hover:bg-(--studio-audio)/20 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
          selected && "border-(--studio-audio) bg-(--studio-audio)/22 ring-(--studio-audio) ring-1",
          muted && "opacity-48",
          locked && "cursor-default opacity-72 saturate-50"
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
          height={innerHeight}
          peaks={peaks}
          pxPerSecond={pxPerSecond}
          width={width - 2}
        />
        {/* Laid out like a video clip: icon and name on top, the duration at the bottom. Each sits on a light scrim
            over the waveform, pulled out by its own padding so the text lines up with a video clip's. */}
        <span className="relative -mx-1 flex min-w-0 max-w-[calc(100%+0.5rem)] items-center gap-1.5 rounded-sm bg-background/56 px-1 leading-4 backdrop-blur-[2px]">
          <MusicIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate font-medium text-foreground text-xs">{clip.name}</span>
          {locked ? <LockIcon aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" /> : null}
        </span>
        {innerHeight >= AUDIO_CLIP_INNER_HEIGHT_PX - 12 ? (
          <span className="relative -mx-1 truncate rounded-sm bg-background/56 px-1 text-[0.625rem] text-muted-foreground tabular-nums leading-3 backdrop-blur-[2px]">
            {copy.seconds(clip.duration)}
          </span>
        ) : null}
      </button>
      {locked ? null : (
        <>
          <EdgeHandle edge="start" onPointerDown={(event) => onPointerDown(event, "trim-start")} />
          <EdgeHandle edge="end" onPointerDown={(event) => onPointerDown(event, "trim-end")} />
        </>
      )}
      {!locked && width >= MIN_FADE_HANDLES_WIDTH_PX ? (
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
