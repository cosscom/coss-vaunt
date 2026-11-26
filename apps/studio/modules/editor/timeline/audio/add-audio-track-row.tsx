"use client";

import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useState } from "react";
import { hasAssetDrag } from "../../assets/asset-drag";
import { AUDIO_COPY } from "../../audio/audio-copy";
import { NEW_TRACK_ROW_HEIGHT_PX } from "../timeline-metrics";
import { PLACEHOLDER_ROW_HATCH, TimelineRow } from "../timeline-row";
import { AUDIO_ROW_HEIGHT_PX } from "./audio-metrics";
import { dropTime } from "./drop-time";

/** Below the audio tracks: dropping audio or moving an audio clip here puts it on a new track. */
export function AddAudioTrackRow({
  contentWidth,
  toX,
  pxPerSecond,
  trackIndex,
  compact,
  onDrop,
}: {
  contentWidth: number;
  /** The index the new track will have, one below the last track. */
  trackIndex: number;
  /** Slimmer once the project has audio tracks of its own. */
  compact: boolean;
  toX: (seconds: number) => number;
  pxPerSecond: number;
  onDrop: (dataTransfer: DataTransfer, time: number) => void;
}): React.ReactElement {
  const [over, setOver] = useState(false);
  const accepts = (event: React.DragEvent) =>
    event.dataTransfer.types.includes("Files") || hasAssetDrag(event.dataTransfer);
  return (
    <TimelineRow
      className={cn(
        PLACEHOLDER_ROW_HATCH,
        over && "bg-(--studio-audio)/12 outline-(--studio-audio)/48 outline-2 -outline-offset-2"
      )}
      contentWidth={contentWidth}
      data-audio-track-index={trackIndex}
      data-testid="audio-add-track-drop"
      headerClassName={PLACEHOLDER_ROW_HATCH}
      header={null}
      height={compact ? NEW_TRACK_ROW_HEIGHT_PX : AUDIO_ROW_HEIGHT_PX}
      onDragLeave={() => setOver(false)}
      onDragOver={(event) => {
        if (!accepts(event)) return;
        event.preventDefault();
        setOver(true);
      }}
      onDrop={(event) => {
        if (!accepts(event)) return;
        event.preventDefault();
        setOver(false);
        const left = event.currentTarget.getBoundingClientRect().left;
        onDrop(event.dataTransfer, dropTime(event.clientX, left, pxPerSecond));
      }}>
      <p
        className="pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground/72 text-xs"
        style={{ left: toX(0) }}>
        {AUDIO_COPY.track.addTrackDrop}
      </p>
    </TimelineRow>
  );
}
