"use client";

import type * as React from "react";
import { useEffect } from "react";
import { type PlaybackClock, usePlaybackState } from "../player/playback-clock";

const FOLLOW_MARGIN_PX = 48;

type TimelinePlayheadProps = {
  clock: PlaybackClock;
  toX: (seconds: number) => number;
};

/** The line across the tracks; it sits under the sticky ruler and track headers. */
export function TimelinePlayhead({
  clock,
  toX,
  offset,
  scrollRef,
}: TimelinePlayheadProps & {
  offset: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}): React.ReactElement {
  const time = usePlaybackState(clock, (state) => state.time);
  const playing = usePlaybackState(clock, (state) => state.playing);
  const left = toX(time);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!playing || !scroller) return;
    const visibleStart = scroller.scrollLeft;
    const visibleEnd = visibleStart + scroller.clientWidth - offset - FOLLOW_MARGIN_PX;
    if (left > visibleEnd || left < visibleStart) scroller.scrollLeft = Math.max(0, left - FOLLOW_MARGIN_PX);
  }, [left, offset, playing, scrollRef]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 z-10 w-px bg-foreground"
      data-testid="playhead"
      style={{ left: offset + left }}
    />
  );
}

/** The playhead's grip in the ruler. */
export function RulerPlayheadHead({ clock, toX }: TimelinePlayheadProps): React.ReactElement {
  const time = usePlaybackState(clock, (state) => state.time);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 w-px bg-foreground"
      style={{ left: toX(time) }}>
      <div className="absolute top-0 left-1/2 h-2.5 w-3 -translate-x-1/2 rounded-b-[3px] bg-foreground" />
    </div>
  );
}
