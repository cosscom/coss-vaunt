"use client";

import { Button } from "@coss/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@coss/ui/components/dialog";
import { Label } from "@coss/ui/components/label";
import { NumberField, NumberFieldGroup, NumberFieldInput } from "@coss/ui/components/number-field";
import { Progress } from "@coss/ui/components/progress";
import { Radio, RadioGroup } from "@coss/ui/components/radio-group";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@coss/ui/components/select";
import { Switch } from "@coss/ui/components/switch";
import { CircleCheckIcon, CircleXIcon, DownloadIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import {
  EXPORT_FRAME_RATES,
  EXPORT_PRESETS,
  EXPORT_RESOLUTIONS,
  type ExportPreset,
  type ExportResolution,
  type ExportSettings,
  estimatedBytes,
  exportSize,
  MAX_VIDEO_BITRATE_MBPS,
  MIN_VIDEO_BITRATE_MBPS,
  matchingPreset,
  presetSettings,
} from "@coss/vaunt-engine/export/export-settings";
import type { Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { projectDuration } from "@coss/vaunt-engine/storyboard/track-resolution";
import type * as React from "react";
import { useState } from "react";
import type { SaveStatus } from "../use-project-autosave";
import { type ExportState, useProjectExport } from "./use-project-export";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.exportDialog;

function percentOf(state: ExportState): number {
  if (state.status !== "running" || state.frameCount === 0) return 0;
  return Math.round((state.frame / state.frameCount) * 100);
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-3">
      <span className="text-muted-foreground text-sm">{label}</span>
      {children}
    </div>
  );
}

function SettingsForm({
  project,
  settings,
  onChange,
}: {
  project: Project;
  settings: ExportSettings;
  onChange: (settings: ExportSettings) => void;
}): React.ReactElement {
  const fps = project.settings.fps;
  const preset = matchingPreset(settings, fps);
  const rates = [...new Set([...EXPORT_FRAME_RATES, fps])].sort((a, b) => a - b);
  const hasAudio = project.audioTracks.some((track) => !track.muted && track.clips.length > 0);
  const resolutionItems = EXPORT_RESOLUTIONS.map((resolution) => {
    const size = exportSize(project.settings.aspectRatio, resolution);
    return { value: resolution, label: `${resolution} · ${size.width} × ${size.height}` };
  });
  const rateItems = rates.map((rate) => ({ value: String(rate), label: copy.fps(rate) }));
  const lossless = settings.format === "prores";

  return (
    <div className="flex flex-col gap-5">
      <RadioGroup
        aria-label={copy.title}
        className="grid grid-cols-3 gap-2"
        onValueChange={(value) => {
          const next = EXPORT_PRESETS.find((candidate) => candidate === value);
          if (next) onChange(presetSettings(next, fps));
        }}
        value={preset ?? ""}>
        {EXPORT_PRESETS.map((id: ExportPreset) => (
          <Label
            className="flex cursor-pointer flex-col items-start gap-1 rounded-lg border p-3 font-normal transition-colors hover:bg-accent/48 has-data-checked:border-info has-data-checked:bg-info/8"
            key={id}>
            <span className="flex items-center gap-2">
              <Radio value={id} />
              <span className="font-medium text-foreground text-sm">{copy.presets[id].name}</span>
            </span>
            <span className="text-muted-foreground text-xs">{copy.presets[id].detail}</span>
          </Label>
        ))}
      </RadioGroup>
      {preset ? null : <p className="-mt-3 text-muted-foreground text-xs">{copy.custom}</p>}

      <div className="flex flex-col gap-3">
        <SettingRow label={copy.resolution}>
          <Select
            items={resolutionItems}
            onValueChange={(value) => {
              const resolution = EXPORT_RESOLUTIONS.find((candidate) => candidate === value);
              if (resolution) onChange({ ...settings, resolution: resolution as ExportResolution });
            }}
            value={settings.resolution}>
            <SelectTrigger aria-label={copy.resolution} className="tabular-nums" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {resolutionItems.map((item) => (
                <SelectItem className="tabular-nums" key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </SettingRow>
        <SettingRow label={copy.frameRate}>
          <Select
            items={rateItems}
            onValueChange={(value) => value && onChange({ ...settings, fps: Number(value) })}
            value={String(settings.fps)}>
            <SelectTrigger aria-label={copy.frameRate} className="tabular-nums" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {rateItems.map((item) => (
                <SelectItem className="tabular-nums" key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </SettingRow>
        <SettingRow label={copy.bitrate}>
          {lossless ? (
            <span className="text-muted-foreground text-sm">{copy.bitrateLossless}</span>
          ) : (
            <NumberField
              className="w-36"
              max={MAX_VIDEO_BITRATE_MBPS}
              min={MIN_VIDEO_BITRATE_MBPS}
              onValueChange={(value) => value !== null && onChange({ ...settings, videoBitrateMbps: value })}
              size="sm"
              step={1}
              value={settings.videoBitrateMbps}>
              <NumberFieldGroup>
                <NumberFieldInput aria-label={copy.bitrate} className="tabular-nums" />
                <span className="pe-2.5 text-muted-foreground text-xs">{copy.bitrateUnit}</span>
              </NumberFieldGroup>
            </NumberField>
          )}
        </SettingRow>
        <SettingRow label={copy.audio}>
          <span className="flex items-center gap-2">
            <Switch
              aria-label={copy.audio}
              checked={settings.audio && hasAudio}
              disabled={!hasAudio}
              onCheckedChange={(audio) => onChange({ ...settings, audio })}
            />
            {hasAudio ? null : <span className="text-muted-foreground text-xs">{copy.noAudio}</span>}
          </span>
        </SettingRow>
      </div>
    </div>
  );
}

function ExportProgress({
  state,
  onCancel,
}: {
  state: ExportState;
  onCancel: () => void;
}): React.ReactElement {
  const running = state.status === "running" ? state : null;
  const phase = running?.phase ?? "load";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-foreground">{copy.phases[phase]}</span>
        {running && phase === "frames" ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {copy.frameProgress(running.frame, running.frameCount)}
            {running.etaSeconds !== null ? ` · ${copy.timeLeft(running.etaSeconds)}` : ""}
          </span>
        ) : null}
      </div>
      <Progress value={phase === "encode" ? 100 : percentOf(state)} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">{copy.keepsRunning}</p>
        <Button onClick={onCancel} size="sm" variant="outline">
          {copy.cancel}
        </Button>
      </div>
    </div>
  );
}

/** The project bar's Export button and its dialog: pick a preset or tune the settings, then follow the render. */
export function ExportButton({
  project,
  saveStatus,
}: {
  project: Project;
  saveStatus: SaveStatus;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ExportSettings>(() =>
    presetSettings("social", project.settings.fps)
  );
  const { state, start, cancel, reset } = useProjectExport(project.id);
  const busy = state.status === "starting" || state.status === "running";
  const duration = projectDuration(project);
  const size = exportSize(project.settings.aspectRatio, settings.resolution);
  const filesUrl = `/api/projects/${encodeURIComponent(project.id)}/files`;

  return (
    <>
      <Button
        className={cn(busy && "tabular-nums")}
        disabled={duration <= 0}
        onClick={() => setOpen(true)}
        size="sm">
        <DownloadIcon aria-hidden="true" />
        {busy ? copy.exporting(percentOf(state)) : STUDIO_COPY.editor.export}
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          <DialogPanel>
            {busy ? (
              <ExportProgress onCancel={cancel} state={state} />
            ) : state.status === "done" ? (
              <div className="flex items-start gap-3">
                <CircleCheckIcon
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-success-foreground"
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="font-medium text-foreground text-sm">{copy.done}</p>
                  <p className="truncate text-muted-foreground text-xs">
                    {state.file.split("/").pop()} · {copy.fileSize(state.bytes)}
                  </p>
                </div>
              </div>
            ) : state.status === "error" ? (
              <div className="flex items-start gap-3">
                <CircleXIcon
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-destructive-foreground"
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="font-medium text-foreground text-sm">{copy.failed}</p>
                  <p className="break-words text-muted-foreground text-xs">{state.message}</p>
                </div>
              </div>
            ) : (
              <SettingsForm onChange={setSettings} project={project} settings={settings} />
            )}
          </DialogPanel>
          <DialogFooter>
            {state.status === "done" ? (
              <>
                <Button onClick={reset} variant="ghost">
                  {copy.another}
                </Button>
                <Button render={<a download href={`${filesUrl}/${state.file}?download`} />}>
                  <DownloadIcon aria-hidden="true" />
                  {copy.download}
                </Button>
              </>
            ) : state.status === "error" ? (
              <>
                <DialogClose render={<Button variant="ghost" />}>{copy.close}</DialogClose>
                <Button onClick={reset}>{copy.tryAgain}</Button>
              </>
            ) : busy ? (
              <DialogClose render={<Button variant="ghost" />}>{copy.close}</DialogClose>
            ) : (
              <>
                <span className="me-auto self-center text-muted-foreground text-xs tabular-nums">
                  {copy.summary(
                    settings.format === "mp4" ? "MP4" : "ProRes",
                    size.width,
                    size.height,
                    settings.fps,
                    copy.fileSize(estimatedBytes(settings, size, duration))
                  )}
                </span>
                <Button
                  disabled={saveStatus !== "saved"}
                  onClick={() => void start({ ...settings, audio: settings.audio })}>
                  {saveStatus === "saved" ? copy.start : copy.waitForSave}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}
