"use client";

import type { Clip } from "@calcom/product-video/storyboard/storyboard-schema";
import { CaptionsIcon, FileIcon, FocusIcon, MonitorIcon, VideoIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useState } from "react";
import { hasMotionDrag, MOTION_DRAG_TYPE, type MotionDrop, parseMotionDrag } from "../motion/motion-drag";
import { STUDIO_COPY } from "@/modules/studio-copy";

const KIND_ICONS = {
  recording: MonitorIcon,
  import: VideoIcon,
  image: FileIcon,
  text: CaptionsIcon,
} as const;

type TimelineClipProps = {
  clip: Clip;
  left: number;
  width: number;
  selected: boolean;
  /** Width hidden under transition bands at either end, so the label stays readable. */
  insetStart: number;
  insetEnd: number;
  onPointerDown: (event: React.PointerEvent, mode: ClipDragMode) => void;
  onSelect: () => void;
  /** A motion preset dropped from the motion pane. */
  onMotionDrop?: (drop: MotionDrop) => void;
};

function TrimHandle({
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
        "absolute inset-y-0 z-3 flex w-2 cursor-ew-resize touch-none items-center justify-center opacity-0 transition-opacity group-hover/clip:opacity-100 group-data-selected/clip:opacity-100",
        edge === "start" ? "start-0" : "end-0"
      )}
      data-testid={`trim-${edge}`}
      onPointerDown={onPointerDown}>
      <span className="h-4 w-0.5 rounded-full bg-foreground/48" />
    </div>
  );
}

export type ClipDragMode = "move" | "trim-start" | "trim-end";

export function TimelineClip({
  clip,
  left,
  width,
  selected,
  insetStart,
  insetEnd,
  onPointerDown,
  onSelect,
  onMotionDrop,
}: TimelineClipProps): React.ReactElement {
  const Icon = KIND_ICONS[clip.source.kind];
  const [motionOver, setMotionOver] = useState(false);
  return (
    <div
      className="group/clip absolute inset-y-1.5"
      onDragLeave={(event) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)))
          setMotionOver(false);
      }}
      onDragOver={(event) => {
        if (!onMotionDrop || !hasMotionDrag(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";
        setMotionOver(true);
      }}
      onDrop={(event) => {
        if (!onMotionDrop || !hasMotionDrag(event.dataTransfer)) return;
        event.preventDefault();
        event.stopPropagation();
        setMotionOver(false);
        const drop = parseMotionDrag(event.dataTransfer.getData(MOTION_DRAG_TYPE));
        if (drop) onMotionDrop(drop);
      }}
      data-clip-id={clip.id}
      data-menu="clip"
      data-selected={selected ? "" : undefined}
      data-testid="timeline-clip"
      style={{ left, width }}>
      <button
        aria-pressed={selected}
        className={cn(
          "flex size-full cursor-grab touch-none select-none flex-col justify-between overflow-hidden rounded-md border bg-card px-2 py-1.5 text-start shadow-xs/5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
          selected && "border-foreground/64 bg-accent ring-1 ring-foreground/64",
          motionOver && "border-info bg-info/8 ring-2 ring-info/48"
        )}
        onClick={(event) => {
          if (event.detail === 0) onSelect();
        }}
        onPointerDown={(event) => onPointerDown(event, "move")}
        style={{ paddingInlineStart: insetStart + 8, paddingInlineEnd: insetEnd + 8 }}
        type="button">
        <span className="flex min-w-0 items-center gap-1.5">
          <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate font-medium text-foreground text-xs leading-4">{clip.name}</span>
          {clip.drift ? (
            <FocusIcon
              aria-label={STUDIO_COPY.drift.onClip}
              className="size-3 shrink-0 text-info-foreground"
            />
          ) : null}
        </span>
        <span className="truncate text-[0.625rem] text-muted-foreground tabular-nums leading-3">
          {clip.duration.toFixed(1)} s
        </span>
      </button>
      <TrimHandle edge="start" onPointerDown={(event) => onPointerDown(event, "trim-start")} />
      <TrimHandle edge="end" onPointerDown={(event) => onPointerDown(event, "trim-end")} />
    </div>
  );
}
