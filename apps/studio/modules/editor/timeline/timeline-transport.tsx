"use client";

import type { Clip } from "@calcom/product-video/storyboard/storyboard-schema";
import { Button } from "@coss/ui/components/button";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@coss/ui/components/menu";
import { Toggle } from "@coss/ui/components/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import {
  ArrowLeftRightIcon,
  ArrowRightIcon,
  CaptionsIcon,
  ChevronDownIcon,
  LayersIcon,
  MinusIcon,
  MonitorIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RepeatIcon,
  UploadIcon,
} from "@coss/ui/icons";
import type * as React from "react";
import { ImportYoutubeButton } from "../imports/import-youtube-button";
import { type PlaybackClock, usePlaybackState } from "../player/playback-clock";
import { formatTimecode } from "./format-timecode";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.timeline;

type TimelineTransportProps = {
  clock: PlaybackClock;
  projectId: string;
  onAddClip: (kind: NewClipKind) => void;
  onAddTrack: () => void;
  onImported: (clip: Clip) => void;
  onImportMedia: () => void;
  onZoom: (direction: "in" | "out" | "fit") => void;
};

function IconButtonWithTooltip({
  label,
  children,
  ...props
}: { label: string; children: React.ReactNode } & React.ComponentProps<typeof Button>): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button aria-label={label} size="icon-sm" variant="ghost" {...props} />}>
        {children}
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

function PlayButton({ clock }: { clock: PlaybackClock }): React.ReactElement {
  const playing = usePlaybackState(clock, (state) => state.playing);
  const empty = usePlaybackState(clock, (state) => state.duration === 0);
  const label = playing ? copy.pause : copy.play;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            data-testid="play-toggle"
            disabled={empty}
            onClick={() => clock.toggle()}
            size="icon-sm"
            variant="outline"
          />
        }>
        {playing ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
      </TooltipTrigger>
      <TooltipPopup>
        {label} <span className="text-muted-foreground">Space</span>
      </TooltipPopup>
    </Tooltip>
  );
}

function LoopToggle({ clock }: { clock: PlaybackClock }): React.ReactElement {
  const loop = usePlaybackState(clock, (state) => state.loop);
  const label = loop ? copy.loopOn : copy.loopOff;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            aria-label={copy.loop}
            className="size-7 min-w-7 sm:size-7 sm:min-w-7"
            data-testid="loop-toggle"
            onPressedChange={(pressed) => clock.setLoop(pressed)}
            pressed={loop}
            size="sm"
            variant="outline"
          />
        }>
        {loop ? <RepeatIcon aria-hidden="true" /> : <ArrowRightIcon aria-hidden="true" />}
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

function Timecode({ clock }: { clock: PlaybackClock }): React.ReactElement {
  const time = usePlaybackState(clock, (state) => state.time);
  const duration = usePlaybackState(clock, (state) => state.duration);
  return (
    <p className="text-xs tabular-nums" data-testid="timecode">
      <span className="text-foreground">{formatTimecode(time)}</span>
      <span className="text-muted-foreground"> / {formatTimecode(duration)}</span>
    </p>
  );
}

export type NewClipKind = "recording" | "text";

export function TimelineTransport({
  clock,
  projectId,
  onAddClip,
  onAddTrack,
  onImported,
  onImportMedia,
  onZoom,
}: TimelineTransportProps): React.ReactElement {
  return (
    <div className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-3">
      <div className="flex items-center gap-2">
        <Menu>
          <MenuTrigger render={<Button size="sm" variant="outline" />}>
            <PlusIcon aria-hidden="true" />
            {copy.add}
            <ChevronDownIcon aria-hidden="true" className="opacity-60" />
          </MenuTrigger>
          <MenuPopup align="start">
            <MenuItem onClick={() => onAddClip("recording")}>
              <MonitorIcon aria-hidden="true" />
              {copy.addRecording}
            </MenuItem>
            <MenuItem onClick={() => onAddClip("text")}>
              <CaptionsIcon aria-hidden="true" />
              {copy.addText}
            </MenuItem>
            <MenuItem onClick={onImportMedia}>
              <UploadIcon aria-hidden="true" />
              {STUDIO_COPY.timeline.menu.importMedia}
            </MenuItem>
            <MenuSeparator />
            <MenuItem onClick={onAddTrack}>
              <LayersIcon aria-hidden="true" />
              {copy.addTrack}
            </MenuItem>
          </MenuPopup>
        </Menu>
        <ImportYoutubeButton onImported={onImported} projectId={projectId} />
      </div>
      <div className="flex items-center gap-2">
        <LoopToggle clock={clock} />
        <PlayButton clock={clock} />
        <Timecode clock={clock} />
      </div>
      <div className="flex items-center justify-end gap-0.5">
        <IconButtonWithTooltip label={copy.zoomOut} onClick={() => onZoom("out")}>
          <MinusIcon aria-hidden="true" />
        </IconButtonWithTooltip>
        <IconButtonWithTooltip label={copy.zoomIn} onClick={() => onZoom("in")}>
          <PlusIcon aria-hidden="true" />
        </IconButtonWithTooltip>
        <IconButtonWithTooltip label={copy.zoomToFit} onClick={() => onZoom("fit")}>
          <ArrowLeftRightIcon aria-hidden="true" />
        </IconButtonWithTooltip>
      </div>
    </div>
  );
}
