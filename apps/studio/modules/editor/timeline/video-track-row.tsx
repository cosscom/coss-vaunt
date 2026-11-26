"use client";

import { Button } from "@coss/ui/components/button";
import { Toggle } from "@coss/ui/components/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { ChevronDownIcon, EyeIcon, EyeOffIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import { PROPERTY_SPECS, type PropertyKey } from "@coss/vaunt-engine/storyboard/property-specs";
import type { Clip, Keyframe, VideoTrack } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type * as React from "react";
import { useState } from "react";
import { hasAssetDrag } from "../assets/asset-drag";
import { CLOSE_UP_SECTION_ID } from "../inspector/drift-section";
import type { MotionDrop } from "../motion/motion-drag";
import type { PlaybackClock } from "../player/playback-clock";
import { AddLaneMenu } from "./add-lane-menu";
import { CloseUpLane } from "./close-up-lane";
import { KeyframeLane } from "./keyframe-lane";
import { laneProperties } from "./keyframed-properties";
import { PROPERTY_GROUP_TONE } from "./property-group-tone";
import { type ClipDragMode, TimelineClip } from "./timeline-clip";
import { KEYFRAME_LANE_HEIGHT_PX, VIDEO_TRACK_HEIGHT_PX } from "./timeline-metrics";
import { TimelineRow } from "./timeline-row";
import { TrackLockToggle } from "./track-lock-toggle";
import { TransitionBand } from "./transition-band";
import { transitionRegions } from "./transition-regions";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.timeline;

type VideoTrackRowProps = {
  track: VideoTrack;
  trackIndex: number;
  clock: PlaybackClock;
  contentWidth: number;
  pxPerSecond: number;
  toX: (seconds: number) => number;
  selectedClipIds: ReadonlySet<string>;
  /** The clip whose keyframe lanes show under this track, when it's on this track. */
  primaryClipId: string | null;
  selectedKeyframeIds: ReadonlySet<string>;
  keyframeTolerance: number;
  lanesOpen: boolean;
  shownLanes: readonly PropertyKey[];
  selectedLanes: readonly PropertyKey[];
  onSelectLane: (key: PropertyKey, additive: boolean) => void;
  onShowLane: (key: PropertyKey) => void;
  emptyHint: boolean;
  onToggleLanes: () => void;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
  /** The track row's height, which its bottom edge resizes. */
  height: number;
  onResize: (height: number) => void;
  onResetHeight: () => void;
  onSelectTransition: (clipId: string) => void;
  onSelectClip: (clipId: string) => void;
  onClipPointerDown: (event: React.PointerEvent, clip: Clip, mode: ClipDragMode) => void;
  onKeyframePointerDown: (
    event: React.PointerEvent,
    clip: Clip,
    keyframe: Keyframe,
    key: PropertyKey
  ) => void;
  onMarqueePointerDown: (event: React.PointerEvent, kind: "clips" | "keyframes") => void;
  onDropFiles: (dataTransfer: DataTransfer, clientX: number) => void;
  onMotionDrop: (clipId: string, drop: MotionDrop) => void;
};

/** Disabled buttons swallow pointer events, so the tooltip anchors on a wrapper that still says why. */
function HeaderButton({
  label,
  children,
  ...props
}: { label: string } & React.ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <Button aria-label={label} className="disabled:opacity-40" size="icon-xs" variant="ghost" {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

export function VideoTrackRow({
  track,
  trackIndex,
  clock,
  contentWidth,
  pxPerSecond,
  toX,
  selectedClipIds,
  primaryClipId,
  selectedKeyframeIds,
  keyframeTolerance,
  lanesOpen,
  shownLanes,
  selectedLanes,
  onSelectLane,
  onShowLane,
  emptyHint,
  onToggleLanes,
  onToggleHidden,
  onToggleLocked,
  height,
  onResize,
  onResetHeight,
  onSelectTransition,
  onSelectClip,
  onClipPointerDown,
  onKeyframePointerDown,
  onMarqueePointerDown,
  onDropFiles,
  onMotionDrop,
}: VideoTrackRowProps): React.ReactElement {
  const [dropping, setDropping] = useState(false);
  const laneClip = track.clips.find((clip) => clip.id === primaryClipId) ?? null;
  const lanes = laneClip ? laneProperties(laneClip, shownLanes) : [];
  const closeUp = laneClip?.drift ?? null;
  const hasLanes = lanes.length > 0 || closeUp !== null;
  const showLanes = lanesOpen && hasLanes;
  const toggleLabel = showLanes ? copy.collapseLanes : copy.expandLanes;
  const laneLabel = hasLanes ? toggleLabel : copy.noKeyframes;
  const visibilityLabel = track.hidden ? copy.trackHidden(track.name) : copy.trackVisible(track.name);
  const regions = transitionRegions(track);
  const overlapPx = (clipId: string, side: "clipId" | "outgoingClipId") => {
    const region = regions.find((candidate) => candidate[side] === clipId);
    return region ? (region.end - region.start) * pxPerSecond : 0;
  };
  const locked = Boolean(track.locked);
  // A locked track refuses drops: without preventDefault the browser shows the no-drop cursor.
  const hasFiles = (event: React.DragEvent) =>
    !locked && (event.dataTransfer.types.includes("Files") || hasAssetDrag(event.dataTransfer));

  return (
    <div data-testid="video-track">
      <TimelineRow
        className={cn("bg-muted/40", dropping && "bg-info/12 outline-2 outline-info/48 -outline-offset-2")}
        contentWidth={contentWidth}
        data-menu="video-lane"
        data-track-index={trackIndex}
        header={
          <div
            className="flex min-w-0 flex-1 items-center gap-1"
            data-menu="track"
            data-track-index={trackIndex}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Toggle
                    aria-label={visibilityLabel}
                    className="size-6 min-w-6 sm:size-6 sm:min-w-6"
                    onPressedChange={onToggleHidden}
                    pressed={!track.hidden}
                    size="sm"
                  />
                }>
                {track.hidden ? (
                  <EyeOffIcon aria-hidden="true" className="text-muted-foreground" />
                ) : (
                  <EyeIcon aria-hidden="true" />
                )}
              </TooltipTrigger>
              <TooltipPopup>{visibilityLabel}</TooltipPopup>
            </Tooltip>
            <TrackLockToggle locked={locked} name={track.name} onToggle={onToggleLocked} />
            <span
              className={cn(
                "ms-1 min-w-0 flex-1 truncate font-medium text-foreground text-xs",
                track.hidden && "text-muted-foreground line-through"
              )}>
              {track.name}
            </span>
            {laneClip ? <AddLaneMenu onShowLane={onShowLane} shown={lanes.map((lane) => lane.key)} /> : null}
            <HeaderButton
              aria-expanded={showLanes}
              disabled={!hasLanes}
              label={laneLabel}
              onClick={onToggleLanes}>
              <ChevronDownIcon
                aria-hidden="true"
                className={cn("transition-transform", !showLanes && "-rotate-90")}
              />
            </HeaderButton>
          </div>
        }
        height={height}
        resize={{ label: copy.resizeTrack(track.name), onResize, onReset: onResetHeight }}
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
          onDropFiles(event.dataTransfer, event.clientX);
        }}
        onPointerDown={(event) => onMarqueePointerDown(event, "clips")}>
        {emptyHint ? (
          <p
            className="pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground text-xs"
            style={{ left: toX(0) }}>
            {copy.noClips}
          </p>
        ) : null}
        <div className={cn("contents", track.hidden && "*:opacity-48")}>
          {track.clips.map((clip) => (
            <TimelineClip
              clip={clip}
              compact={height < VIDEO_TRACK_HEIGHT_PX}
              insetEnd={overlapPx(clip.id, "outgoingClipId")}
              insetStart={overlapPx(clip.id, "clipId")}
              key={clip.id}
              left={toX(clip.start)}
              locked={locked}
              onPointerDown={(event, mode) => onClipPointerDown(event, clip, mode)}
              onMotionDrop={(drop) => onMotionDrop(clip.id, drop)}
              onSelect={() => onSelectClip(clip.id)}
              selected={selectedClipIds.has(clip.id)}
              width={Math.max(4, clip.duration * pxPerSecond)}
            />
          ))}
        </div>
        {regions.map((region) => (
          <TransitionBand
            key={region.clipId}
            left={toX(region.start)}
            locked={locked}
            onSelect={() => onSelectTransition(region.clipId)}
            region={region}
            selected={selectedClipIds.has(region.clipId)}
            width={(region.end - region.start) * pxPerSecond}
          />
        ))}
      </TimelineRow>
      {laneClip && closeUp && showLanes ? (
        <CloseUpLane
          clip={laneClip}
          contentWidth={contentWidth}
          drift={closeUp}
          left={toX(laneClip.start)}
          onOpen={() => {
            onSelectClip(laneClip.id);
            document
              .getElementById(CLOSE_UP_SECTION_ID)
              ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }}
          width={Math.max(4, laneClip.duration * pxPerSecond)}
        />
      ) : null}
      {laneClip && showLanes
        ? lanes.map(({ key, keyframes }) => (
            <TimelineRow
              contentWidth={contentWidth}
              data-clip-id={laneClip.id}
              data-key={key}
              data-menu="lane"
              data-testid="keyframe-lane"
              header={
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        aria-label={copy.laneLabel(
                          copy.menu.groups[PROPERTY_SPECS[key].group],
                          PROPERTY_SPECS[key].label
                        )}
                        aria-pressed={selectedLanes.includes(key)}
                        className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 self-stretch ps-6 pe-1.5 text-start text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        data-clip-id={laneClip.id}
                        data-key={key}
                        data-menu="lane"
                        data-testid="lane-label"
                        onClick={(event) =>
                          onSelectLane(key, event.shiftKey || event.metaKey || event.ctrlKey)
                        }
                        onContextMenu={() => {
                          if (!selectedLanes.includes(key)) onSelectLane(key, false);
                        }}
                        type="button"
                      />
                    }>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          PROPERTY_GROUP_TONE[PROPERTY_SPECS[key].group].dot
                        )}
                      />
                      <span className="truncate text-foreground">{PROPERTY_SPECS[key].label}</span>
                    </span>
                    <span className="text-muted-foreground tabular-nums">{keyframes.length}</span>
                  </TooltipTrigger>
                  <TooltipPopup>
                    {copy.laneLabel(copy.menu.groups[PROPERTY_SPECS[key].group], PROPERTY_SPECS[key].label)}
                  </TooltipPopup>
                </Tooltip>
              }
              height={KEYFRAME_LANE_HEIGHT_PX}
              key={key}
              onContextMenu={() => {
                if (!selectedLanes.includes(key)) onSelectLane(key, false);
              }}
              onPointerDown={(event) => onMarqueePointerDown(event, "keyframes")}
              selected={selectedLanes.includes(key)}>
              <KeyframeLane
                clip={laneClip}
                clock={clock}
                keyframes={keyframes}
                onPointerDown={(event, keyframe) => onKeyframePointerDown(event, laneClip, keyframe, key)}
                propertyKey={key}
                selectedIds={selectedKeyframeIds}
                tolerance={keyframeTolerance}
                toX={toX}
              />
            </TimelineRow>
          ))
        : null}
    </div>
  );
}
