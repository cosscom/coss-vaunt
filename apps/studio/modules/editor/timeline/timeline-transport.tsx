"use client";

import { Button } from "@coss/ui/components/button";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@coss/ui/components/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import {
  ArrowLeftRightIcon,
  ArrowRightIcon,
  CaptionsIcon,
  ChevronDownIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  LayersIcon,
  MinusIcon,
  MonitorIcon,
  PlusIcon,
  RepeatIcon,
  UploadIcon,
} from "@coss/ui/icons";
import type { Clip, Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type * as React from "react";
import { ImportYoutubeButton } from "../imports/import-youtube-button";
import { type PlaybackClock, usePlaybackState } from "../player/playback-clock";
import { formatFrameTimecode } from "./format-timecode";
import savedPlayWave from "./play-wave/play-wave.config.json";
import { PlayWaveButton } from "./play-wave/play-wave-button";
import { DEFAULT_PLAY_WAVE_CONFIG, type PlayWaveConfig } from "./play-wave/play-wave-config";
import { usePlayWaveSampler } from "./play-wave/use-play-wave-sampler";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.timeline;

type TimelineTransportProps = {
  clock: PlaybackClock;
  project: Project;
  onAddClip: (kind: NewClipKind) => void;
  onAddTrack: () => void;
  onImported: (clip: Clip) => void;
  onImportMedia: () => void;
  onZoom: (direction: "in" | "out" | "fit") => void;
  /** The project's frame rate, for the timecode's frames. */
  fps: number;
  /** The timeline's scale against the default, shown between the zoom buttons. */
  zoomPercent: number;
};

const SKIP_SECONDS = 5;

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

const playWaveConfig: PlayWaveConfig = {
  ...DEFAULT_PLAY_WAVE_CONFIG,
  ...(savedPlayWave as Partial<PlayWaveConfig>),
};

/** Play: a solid triangle that opens into the media's waveform while playing (`play-wave/`). */
function PlayButton({ clock, project }: { clock: PlaybackClock; project: Project }): React.ReactElement {
  const playing = usePlaybackState(clock, (state) => state.playing);
  const empty = usePlaybackState(clock, (state) => state.duration === 0);
  const sample = usePlayWaveSampler(project, playWaveConfig.seed);
  const label = playing ? copy.pause : copy.play;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <PlayWaveButton
          config={playWaveConfig}
          disabled={empty}
          getTime={() => clock.currentTime()}
          label={label}
          onToggle={() => clock.toggle()}
          playing={playing}
          sample={sample}
          testId="play-toggle"
        />
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
          <Button
            aria-label={copy.loop}
            aria-pressed={loop}
            className={loop ? undefined : "text-muted-foreground"}
            data-testid="loop-toggle"
            onClick={() => clock.setLoop(!loop)}
            size="icon-sm"
            variant={loop ? "secondary" : "ghost"}
          />
        }>
        {loop ? <RepeatIcon aria-hidden="true" /> : <ArrowRightIcon aria-hidden="true" />}
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

function Timecode({ clock, fps }: { clock: PlaybackClock; fps: number }): React.ReactElement {
  const time = usePlaybackState(clock, (state) => state.time);
  const duration = usePlaybackState(clock, (state) => state.duration);
  return (
    <p className="ms-1 font-medium text-xs tabular-nums" data-testid="timecode">
      <span className="text-foreground">{formatFrameTimecode(time, fps)}</span>
      <span className="text-muted-foreground"> / {formatFrameTimecode(duration, fps)}</span>
    </p>
  );
}

/** Jumps the playhead by `seconds`, clamped to the video. */
function SkipButton({ clock, seconds }: { clock: PlaybackClock; seconds: number }): React.ReactElement {
  const empty = usePlaybackState(clock, (state) => state.duration === 0);
  const label = seconds < 0 ? copy.skipBack : copy.skipForward;
  return (
    <IconButtonWithTooltip
      disabled={empty}
      label={label}
      onClick={() => clock.seek(clock.currentTime() + seconds)}>
      {seconds < 0 ? <ChevronsLeftIcon aria-hidden="true" /> : <ChevronsRightIcon aria-hidden="true" />}
    </IconButtonWithTooltip>
  );
}

export type NewClipKind = "recording" | "text";

export function TimelineTransport({
  clock,
  project,
  onAddClip,
  onAddTrack,
  onImported,
  onImportMedia,
  onZoom,
  fps,
  zoomPercent,
}: TimelineTransportProps): React.ReactElement {
  return (
    <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b" data-snug="">
      <div className="flex items-center gap-2">
        <Menu>
          <MenuTrigger render={<Button variant="secondary" />}>
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
        <ImportYoutubeButton onImported={onImported} projectId={project.id} />
      </div>
      <div className="flex items-center gap-1">
        <SkipButton clock={clock} seconds={-SKIP_SECONDS} />
        <PlayButton clock={clock} project={project} />
        <SkipButton clock={clock} seconds={SKIP_SECONDS} />
        <Timecode clock={clock} fps={fps} />
      </div>
      <div className="flex items-center justify-end gap-0.5">
        <IconButtonWithTooltip label={copy.zoomOut} onClick={() => onZoom("out")}>
          <MinusIcon aria-hidden="true" />
        </IconButtonWithTooltip>
        <span
          aria-label={copy.zoomLevel(zoomPercent)}
          className="w-10 text-center text-muted-foreground text-xs tabular-nums"
          data-testid="zoom-level">
          {zoomPercent}%
        </span>
        <IconButtonWithTooltip label={copy.zoomIn} onClick={() => onZoom("in")}>
          <PlusIcon aria-hidden="true" />
        </IconButtonWithTooltip>
        <IconButtonWithTooltip label={copy.zoomToFit} onClick={() => onZoom("fit")}>
          <ArrowLeftRightIcon aria-hidden="true" />
        </IconButtonWithTooltip>
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
        <LoopToggle clock={clock} />
      </div>
    </div>
  );
}
