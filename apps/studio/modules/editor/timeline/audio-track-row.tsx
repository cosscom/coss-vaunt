"use client";

import type { AudioClip, AudioTrack } from "@calcom/product-video/storyboard/storyboard-schema";
import { Button } from "@coss/ui/components/button";
import { Toggle } from "@coss/ui/components/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { MusicIcon, UploadIcon, Volume2Icon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useState } from "react";
import { hasAssetDrag } from "../assets/asset-drag";
import { AUDIO_COPY } from "../audio/audio-copy";
import type { PlaybackClock } from "../player/playback-clock";
import type { AudioActions } from "./audio/audio-actions";
import { AudioClipBlock } from "./audio/audio-clip-block";
import { AudioClipMenu } from "./audio/audio-clip-menu";
import type { AudioDragMode } from "./audio/audio-drag";
import { AUDIO_ROW_HEIGHT_PX } from "./audio/audio-metrics";
import { dropTime } from "./audio/drop-time";
import { TimelineRow } from "./timeline-row";

const copy = AUDIO_COPY.track;

type AudioTrackRowProps = {
  track: AudioTrack;
  trackIndex: number;
  projectId: string;
  clock: PlaybackClock;
  contentWidth: number;
  pxPerSecond: number;
  toX: (seconds: number) => number;
  selectedClipIds: ReadonlySet<string>;
  actions: AudioActions;
  onClipPointerDown: (event: React.PointerEvent, clip: AudioClip, mode: AudioDragMode) => void;
  onSelectClip: (clipId: string) => void;
  onClearSelection: () => void;
  /** Files dropped at a time in seconds, read from the drop point. */
  onDropFiles: (dataTransfer: DataTransfer, time: number) => void;
  onImport: () => void;
};

function HeaderTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

export function AudioTrackRow({
  track,
  trackIndex,
  projectId,
  clock,
  contentWidth,
  pxPerSecond,
  toX,
  selectedClipIds,
  actions,
  onClipPointerDown,
  onSelectClip,
  onClearSelection,
  onDropFiles,
  onImport,
}: AudioTrackRowProps): React.ReactElement {
  const [dropping, setDropping] = useState(false);
  const muteLabel = track.muted ? copy.unmute(track.name) : copy.mute(track.name);
  const hasFiles = (event: React.DragEvent) =>
    event.dataTransfer.types.includes("Files") || hasAssetDrag(event.dataTransfer);

  return (
    <TimelineRow
      className={cn(
        "bg-muted/24",
        dropping && "bg-(--studio-audio)/12 outline-(--studio-audio)/48 outline-2 -outline-offset-2"
      )}
      contentWidth={contentWidth}
      data-audio-track-index={trackIndex}
      data-menu="audio-lane"
      data-testid="audio-track"
      data-track-index={trackIndex}
      header={
        <>
          <HeaderTooltip label={muteLabel}>
            <Toggle
              aria-label={muteLabel}
              className="size-6 min-w-6 sm:size-6 sm:min-w-6"
              data-testid="audio-mute"
              onPressedChange={() => actions.setMuted(trackIndex, !track.muted)}
              pressed={!track.muted}
              size="sm">
              {track.muted ? (
                <MusicIcon aria-hidden="true" className="text-muted-foreground" />
              ) : (
                <Volume2Icon aria-hidden="true" />
              )}
            </Toggle>
          </HeaderTooltip>
          <span
            className={cn(
              "min-w-0 flex-1 truncate font-medium text-foreground text-xs",
              track.muted && "text-muted-foreground line-through"
            )}>
            {track.name}
          </span>
          <HeaderTooltip label={copy.importAudio}>
            <Button aria-label={copy.importAudio} onClick={onImport} size="icon-xs" variant="ghost">
              <UploadIcon aria-hidden="true" />
            </Button>
          </HeaderTooltip>
        </>
      }
      height={AUDIO_ROW_HEIGHT_PX}
      onDragLeave={() => setDropping(false)}
      onDragOver={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        setDropping(true);
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        setDropping(false);
        const left = event.currentTarget.getBoundingClientRect().left;
        onDropFiles(event.dataTransfer, dropTime(event.clientX, left, pxPerSecond));
      }}
      onPointerDown={(event) => {
        if (event.button === 0 && event.target === event.currentTarget) onClearSelection();
      }}>
      {track.clips.length === 0 ? (
        <p
          className="pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground/72 text-xs"
          style={{ left: toX(0) }}>
          {copy.noAudio}
        </p>
      ) : null}
      {track.clips.map((clip) => (
        <AudioClipMenu
          actions={actions}
          clipId={clip.id}
          key={clip.id}
          onOpen={() => {
            if (!selectedClipIds.has(clip.id)) onSelectClip(clip.id);
          }}
          trackIndex={trackIndex}
          trackMuted={Boolean(track.muted)}>
          <AudioClipBlock
            clip={clip}
            clock={clock}
            left={toX(clip.start)}
            muted={Boolean(track.muted)}
            onPointerDown={(event, mode) => onClipPointerDown(event, clip, mode)}
            onSelect={() => onSelectClip(clip.id)}
            projectId={projectId}
            pxPerSecond={pxPerSecond}
            selected={selectedClipIds.has(clip.id)}
            width={Math.max(4, clip.duration * pxPerSecond)}
          />
        </AudioClipMenu>
      ))}
    </TimelineRow>
  );
}
