"use client";

import type { Clip, Drift } from "@calcom/product-video/storyboard/storyboard-schema";
import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, FocusIcon } from "@coss/ui/icons";
import type * as React from "react";
import { closeUpSummary } from "./close-up-summary";
import { KEYFRAME_LANE_HEIGHT_PX } from "./timeline-metrics";
import { TimelineRow } from "./timeline-row";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.drift;
const DIRECTION_ICONS = {
  left: ArrowLeftIcon,
  right: ArrowRightIcon,
  up: ArrowUpIcon,
  down: ArrowDownIcon,
} as const;

/**
 * The clip's close-up as a lane under it: one bar for the whole clip, with the way the media travels and a mark
 * halfway, where it passes the focus point. Clicking it opens the close-up's settings.
 */
export function CloseUpLane({
  clip,
  drift,
  contentWidth,
  left,
  width,
  onOpen,
}: {
  clip: Clip;
  drift: Drift;
  contentWidth: number;
  left: number;
  width: number;
  onOpen: () => void;
}): React.ReactElement {
  const Icon = drift.motion === "none" ? FocusIcon : DIRECTION_ICONS[drift.direction];
  const summary = closeUpSummary(drift);
  return (
    <TimelineRow
      contentWidth={contentWidth}
      data-clip-id={clip.id}
      data-testid="close-up-lane"
      header={
        <span className="flex min-w-0 flex-1 items-center gap-1.5 ps-6 text-xs">
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-info" />
          <span className="truncate text-foreground">{copy.title}</span>
        </span>
      }
      height={KEYFRAME_LANE_HEIGHT_PX}>
      <button
        aria-label={copy.laneLabel(summary)}
        className="absolute inset-y-1 flex cursor-pointer items-center gap-1 overflow-hidden rounded-sm border border-info/40 bg-info/12 px-1.5 text-[0.625rem] text-info-foreground outline-none transition-colors hover:bg-info/20 focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onOpen}
        style={{ left, width }}
        type="button">
        <span
          aria-hidden="true"
          className="absolute inset-y-0.5 left-1/2 border-info/64 border-l border-dashed"
        />
        <Icon aria-hidden="true" className="relative size-3 shrink-0" />
        <span className="relative min-w-0 truncate tabular-nums">{summary}</span>
      </button>
    </TimelineRow>
  );
}
