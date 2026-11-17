"use client";

import { KEYFRAME_SNAP_SECONDS, keyframeAt } from "@calcom/product-video/storyboard/storyboard-edits";
import { type AudioClip, EASES, type Keyframe } from "@calcom/product-video/storyboard/storyboard-schema";
import {
  ContextMenu,
  ContextMenuGroup,
  ContextMenuGroupLabel,
  ContextMenuItem,
  ContextMenuPopup,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@coss/ui/components/context-menu";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useState } from "react";
import { AUDIO_COPY } from "../../audio/audio-copy";
import type { KeyframeState } from "../../inspector/keyframe-state";
import { KeyframeToggle } from "../../inspector/keyframe-toggle";
import { type PlaybackClock, usePlaybackState } from "../../player/playback-clock";
import { formatTimecode } from "../format-timecode";
import { KEYFRAME_LANE_HEIGHT_PX } from "../timeline-metrics";
import { TimelineRow } from "../timeline-row";
import type { AudioActions } from "./audio-actions";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = AUDIO_COPY;

type AudioVolumeLaneProps = {
  clip: AudioClip;
  contentWidth: number;
  toX: (seconds: number) => number;
  clock: PlaybackClock;
  selectedKeyframeIds: ReadonlySet<string>;
  actions: AudioActions;
  onKeyframePointerDown: (event: React.PointerEvent, keyframe: Keyframe) => void;
};

/** The selected audio clip's volume keyframes, styled like the video keyframe lanes. */
export function AudioVolumeLane({
  clip,
  contentWidth,
  toX,
  clock,
  selectedKeyframeIds,
  actions,
  onKeyframePointerDown,
}: AudioVolumeLaneProps): React.ReactElement {
  const time = usePlaybackState(clock, (state) => state.time);
  const [menuKeyframe, setMenuKeyframe] = useState<Keyframe | null>(null);
  const { keyframes } = clip.volume;
  const first = keyframes[0];
  const last = keyframes[keyframes.length - 1];
  const local = Math.min(clip.duration, Math.max(0, time - clip.start));
  const atPlayhead = keyframeAt(clip.volume, local) !== null;
  const inside = time >= clip.start && time <= clip.start + clip.duration;
  const menuTargets = (keyframe: Keyframe | null) => {
    if (!keyframe) return [];
    return selectedKeyframeIds.has(keyframe.id) ? [...selectedKeyframeIds] : [keyframe.id];
  };
  const targets = menuTargets(menuKeyframe);
  const toggleState = (): KeyframeState => {
    if (atPlayhead && inside) return "at-playhead";
    return keyframes.length > 0 ? "elsewhere" : "none";
  };

  return (
    <TimelineRow
      contentWidth={contentWidth}
      data-testid="audio-volume-lane"
      header={
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2 self-stretch ps-7.5 text-muted-foreground text-xs">
          <span className="truncate">{copy.lane.volume}</span>
          <span className="flex items-center gap-1">
            <span className="tabular-nums">{keyframes.length}</span>
            <KeyframeToggle
              label={copy.lane.volume}
              onToggle={() => inside && actions.toggleVolumeKeyframe(clip.id)}
              state={toggleState()}
            />
          </span>
        </span>
      }
      height={KEYFRAME_LANE_HEIGHT_PX}>
      <ContextMenu>
        <ContextMenuTrigger
          className="absolute inset-0"
          onContextMenu={(event) => {
            event.stopPropagation();
            const id =
              event.target instanceof Element
                ? event.target.closest<HTMLElement>("[data-volume-keyframe-id]")?.dataset.volumeKeyframeId
                : undefined;
            setMenuKeyframe(keyframes.find((keyframe) => keyframe.id === id) ?? null);
          }}>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 bg-(--studio-audio)/10"
            style={{ left: toX(clip.start), width: toX(clip.start + clip.duration) - toX(clip.start) }}
          />
          {first && last && keyframes.length > 1 ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 h-px bg-(--studio-audio)/48"
              style={{
                left: toX(clip.start + first.at),
                width: toX(clip.start + last.at) - toX(clip.start + first.at),
              }}
            />
          ) : null}
          {keyframes.map((keyframe) => {
            const current = Math.abs(clip.start + keyframe.at - time) <= KEYFRAME_SNAP_SECONDS;
            const selected = selectedKeyframeIds.has(keyframe.id);
            return (
              <button
                aria-label={copy.lane.keyframeAt(formatTimecode(keyframe.at))}
                aria-pressed={selected}
                className="group/diamond absolute top-1/2 z-1 flex size-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center outline-none"
                data-testid="audio-keyframe-diamond"
                data-volume-keyframe-id={keyframe.id}
                key={keyframe.id}
                onPointerDown={(event) => onKeyframePointerDown(event, keyframe)}
                style={{ left: toX(clip.start + keyframe.at) }}
                type="button">
                <span
                  className={cn(
                    "size-2.5 rotate-45 rounded-[2px] border border-foreground/72 bg-background transition-colors group-hover/diamond:bg-foreground/48 group-focus-visible/diamond:ring-2 group-focus-visible/diamond:ring-ring",
                    current && "border-foreground bg-foreground group-hover/diamond:bg-foreground",
                    selected &&
                      "border-(--studio-audio) bg-(--studio-audio) ring-(--studio-audio)/32 ring-2 group-hover/diamond:bg-(--studio-audio)"
                  )}
                />
              </button>
            );
          })}
        </ContextMenuTrigger>
        <ContextMenuPopup>
          <ContextMenuGroup>
            <ContextMenuGroupLabel>{copy.menu.ease}</ContextMenuGroupLabel>
            <ContextMenuRadioGroup
              onValueChange={(value) => {
                const ease = EASES.find((candidate) => candidate === value);
                if (ease && targets.length > 0) actions.setKeyframeEase(clip.id, targets, ease);
              }}
              value={menuKeyframe?.ease ?? ""}>
              {EASES.map((ease) => (
                <ContextMenuRadioItem disabled={!menuKeyframe} key={ease} value={ease}>
                  {STUDIO_COPY.eases[ease]}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuItem disabled={!inside} onClick={() => actions.addVolumeKeyframe(clip.id)}>
            {copy.menu.addVolumeKeyframe}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={targets.length === 0}
            onClick={() => actions.deleteKeyframes(clip.id, targets)}
            variant="destructive">
            {copy.menu.deleteKeyframe}
          </ContextMenuItem>
        </ContextMenuPopup>
      </ContextMenu>
    </TimelineRow>
  );
}
