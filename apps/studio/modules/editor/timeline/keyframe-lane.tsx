"use client";

import { cn } from "@coss/ui/lib/utils";
import { PROPERTY_SPECS, type PropertyKey } from "@coss/vaunt-engine/storyboard/property-specs";
import type { Clip, Keyframe } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type * as React from "react";
import { type PlaybackClock, usePlaybackState } from "../player/playback-clock";
import { formatTimecode } from "./format-timecode";
import { PROPERTY_GROUP_TONE } from "./property-group-tone";
import { STUDIO_COPY } from "@/modules/studio-copy";

type KeyframeLaneProps = {
  clip: Clip;
  propertyKey: PropertyKey;
  keyframes: Keyframe[];
  selectedIds: ReadonlySet<string>;
  /** Half a frame: a diamond this close to the playhead reads as under it. */
  tolerance: number;
  clock: PlaybackClock;
  toX: (seconds: number) => number;
  onPointerDown: (event: React.PointerEvent, keyframe: Keyframe) => void;
};

/** Diamonds are outlined, filled under the playhead, and accent-coloured when selected. */
export function KeyframeLane({
  clip,
  propertyKey,
  keyframes,
  selectedIds,
  tolerance,
  clock,
  toX,
  onPointerDown,
}: KeyframeLaneProps): React.ReactElement {
  const time = usePlaybackState(clock, (state) => state.time);
  const first = keyframes[0];
  const last = keyframes[keyframes.length - 1];
  const label = PROPERTY_SPECS[propertyKey].label;

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0",
          PROPERTY_GROUP_TONE[PROPERTY_SPECS[propertyKey].group].gutter
        )}
        style={{ left: toX(clip.start), width: toX(clip.start + clip.duration) - toX(clip.start) }}
      />
      {first && last && keyframes.length > 1 ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 h-px bg-foreground/24"
          style={{
            left: toX(clip.start + first.at),
            width: toX(clip.start + last.at) - toX(clip.start + first.at),
          }}
        />
      ) : null}
      {keyframes.map((keyframe) => {
        const absolute = clip.start + keyframe.at;
        const current = Math.abs(absolute - time) <= tolerance;
        const selected = selectedIds.has(keyframe.id);
        return (
          <button
            aria-label={STUDIO_COPY.timeline.keyframeAt(label, formatTimecode(keyframe.at))}
            aria-pressed={selected}
            className="group/diamond absolute top-1/2 z-1 flex size-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center outline-none"
            data-clip-id={clip.id}
            data-current={current ? "" : undefined}
            data-key={propertyKey}
            data-keyframe-id={keyframe.id}
            data-menu="keyframe"
            data-testid="keyframe-diamond"
            key={keyframe.id}
            onPointerDown={(event) => onPointerDown(event, keyframe)}
            style={{ left: toX(absolute) }}
            type="button">
            <span
              className={cn(
                "size-2.5 rotate-45 rounded-[2px] border border-foreground/72 bg-background transition-colors group-hover/diamond:bg-foreground/48 group-focus-visible/diamond:ring-2 group-focus-visible/diamond:ring-ring",
                current && "border-foreground bg-foreground group-hover/diamond:bg-foreground",
                selected && "border-info bg-info ring-2 ring-info/32 group-hover/diamond:bg-info"
              )}
            />
          </button>
        );
      })}
    </>
  );
}
