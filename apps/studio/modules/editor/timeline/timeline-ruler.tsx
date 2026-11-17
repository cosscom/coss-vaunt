"use client";

import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { rulerTicks } from "./timeline-scale";
import { STUDIO_COPY } from "@/modules/studio-copy";

type TimelineRulerProps = {
  visibleSeconds: number;
  pxPerSecond: number;
  toX: (seconds: number) => number;
  onPointerDown: (event: React.PointerEvent) => void;
};

export function TimelineRuler({
  visibleSeconds,
  pxPerSecond,
  toX,
  onPointerDown,
}: TimelineRulerProps): React.ReactElement {
  return (
    <div
      aria-label={STUDIO_COPY.timeline.ruler}
      className="relative h-full cursor-ew-resize touch-none select-none"
      data-testid="timeline-ruler"
      onPointerDown={onPointerDown}
      role="presentation">
      {rulerTicks(visibleSeconds, pxPerSecond).map((tick) => (
        <div className="absolute bottom-0" key={tick.seconds} style={{ left: toX(tick.seconds) }}>
          <div className={cn("w-px", tick.major ? "h-2.5 bg-foreground/32" : "h-1.5 bg-foreground/16")} />
          {tick.major ? (
            <span className="absolute bottom-3 -translate-x-1/2 text-[0.625rem] text-muted-foreground tabular-nums">
              {tick.seconds}s
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
