"use client";

import { PlusIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useState } from "react";
import { hasAssetDrag } from "../assets/asset-drag";
import { NEW_TRACK_ROW_HEIGHT_PX } from "./timeline-metrics";
import { TimelineRow } from "./timeline-row";
import { STUDIO_COPY } from "@/modules/studio-copy";

/** Above the top video track: dropping media or moving a clip here puts it on a new track. */
export function NewVideoTrackRow({
  contentWidth,
  left,
  trackIndex,
  onDropFiles,
}: {
  contentWidth: number;
  left: number;
  /** The index the new track will have, one above the top track. */
  trackIndex: number;
  onDropFiles: (dataTransfer: DataTransfer, clientX: number) => void;
}): React.ReactElement {
  const [over, setOver] = useState(false);
  const accepts = (event: React.DragEvent) =>
    event.dataTransfer.types.includes("Files") || hasAssetDrag(event.dataTransfer);
  return (
    <TimelineRow
      className={cn("bg-muted/16", over && "bg-info/12 outline-2 outline-info/48 -outline-offset-2")}
      contentWidth={contentWidth}
      data-new-video-track=""
      data-testid="video-add-track-drop"
      data-track-index={trackIndex}
      header={
        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
          <PlusIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{STUDIO_COPY.timeline.newTrack}</span>
        </span>
      }
      height={NEW_TRACK_ROW_HEIGHT_PX}
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
        onDropFiles(event.dataTransfer, event.clientX);
      }}>
      <p
        className="pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground/72 text-xs"
        style={{ left }}>
        {STUDIO_COPY.timeline.newTrackDrop}
      </p>
    </TimelineRow>
  );
}
