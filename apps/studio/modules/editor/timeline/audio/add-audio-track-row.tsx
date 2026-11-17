"use client";

import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useState } from "react";
import { AUDIO_COPY } from "../../audio/audio-copy";
import { TimelineRow } from "../timeline-row";
import { AUDIO_ROW_HEIGHT_PX } from "./audio-metrics";
import { dropTime } from "./drop-time";

/** Shown when the project has no audio track: dropping audio here adds one. */
export function AddAudioTrackRow({
  contentWidth,
  toX,
  pxPerSecond,
  onDrop,
}: {
  contentWidth: number;
  toX: (seconds: number) => number;
  pxPerSecond: number;
  onDrop: (dataTransfer: DataTransfer, time: number) => void;
}): React.ReactElement {
  const [over, setOver] = useState(false);
  return (
    <TimelineRow
      className={cn(
        "bg-muted/16",
        over && "bg-(--studio-audio)/12 outline-(--studio-audio)/48 outline-2 -outline-offset-2"
      )}
      contentWidth={contentWidth}
      data-testid="audio-add-track-drop"
      header={<span className="truncate text-muted-foreground text-xs">{AUDIO_COPY.inspector.title}</span>}
      height={AUDIO_ROW_HEIGHT_PX}
      onDragLeave={() => setOver(false)}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setOver(true);
      }}
      onDrop={(event) => {
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
