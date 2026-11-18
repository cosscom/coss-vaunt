"use client";

import {
  ASPECT_RATIOS,
  type Project,
  type ProjectSettings,
} from "@calcom/product-video/storyboard/storyboard-schema";
import { Button } from "@coss/ui/components/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@coss/ui/components/select";
import { Separator } from "@coss/ui/components/separator";
import { Toggle } from "@coss/ui/components/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import {
  ArrowLeftIcon,
  CheckIcon,
  CircleAlertIcon,
  DownloadIcon,
  LoaderIcon,
  PanelRightIcon,
  PanelRightOpenIcon,
  RotateCcwIcon,
  RotateCwIcon,
} from "@coss/ui/icons";
import { InlineEditableText } from "@coss/ui/shared/inline-editable-text";
import Link from "next/link";
import type * as React from "react";
import { useState } from "react";
import { ComingSoonTooltip } from "./coming-soon-tooltip";
import type { SaveStatus } from "./use-project-autosave";
import { STUDIO_COPY } from "@/modules/studio-copy";
import { AppThemeToggle } from "@/modules/theme/app-theme-toggle";

const copy = STUDIO_COPY.editor;
const aspectItems = ASPECT_RATIOS.map((ratio) => ({ value: ratio, label: ratio }));

type ProjectBarProps = {
  project: Project;
  saveStatus: SaveStatus;
  onRename: (name: string) => void;
  onSettingsChange: (settings: Partial<ProjectSettings>) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  promptOpen: boolean;
  inspectorOpen: boolean;
  onTogglePrompt: () => void;
  onToggleInspector: () => void;
};

function PanelToggle({
  pressed,
  onToggle,
  showLabel,
  hideLabel,
  side,
}: {
  pressed: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
  side: "start" | "end";
}): React.ReactElement {
  const label = pressed ? hideLabel : showLabel;
  const Icon = pressed ? PanelRightIcon : PanelRightOpenIcon;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            aria-label={label}
            className="size-7 min-w-7 sm:size-7 sm:min-w-7"
            onPressedChange={onToggle}
            pressed={pressed}
            size="sm"
            variant="outline"
          />
        }>
        <Icon aria-hidden="true" className={side === "start" ? "-scale-x-100" : undefined} />
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

function HistoryButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <Button aria-label={label} disabled={disabled} onClick={onClick} size="icon-sm" variant="ghost">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }): React.ReactElement {
  const label = { saved: copy.saved, saving: copy.saving, error: copy.saveFailed }[status];
  return (
    <span
      aria-live="polite"
      className="flex items-center gap-1.5 text-muted-foreground text-xs data-[status=error]:text-destructive-foreground"
      data-status={status}
      data-testid="save-status">
      {status === "saved" ? <CheckIcon aria-hidden="true" className="size-3.5" /> : null}
      {status === "saving" ? <LoaderIcon aria-hidden="true" className="size-3.5 animate-spin" /> : null}
      {status === "error" ? <CircleAlertIcon aria-hidden="true" className="size-3.5" /> : null}
      {label}
    </span>
  );
}

export function ProjectBar({
  project,
  saveStatus,
  onRename,
  onSettingsChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  promptOpen,
  inspectorOpen,
  onTogglePrompt,
  onToggleInspector,
}: ProjectBarProps): React.ReactElement {
  const [draftName, setDraftName] = useState(project.name);

  return (
    <header className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={copy.backToProjects}
                render={<Link href="/" />}
                size="icon-sm"
                variant="ghost"
              />
            }>
            <ArrowLeftIcon aria-hidden="true" />
          </TooltipTrigger>
          <TooltipPopup>{copy.backToProjects}</TooltipPopup>
        </Tooltip>
        <Separator className="h-5" orientation="vertical" />
        <InlineEditableText
          aria-label={copy.projectName}
          className="min-w-0 font-medium text-sm *:data-[slot=inline-editable-text-field]:rounded-md *:data-[slot=inline-editable-text-field]:px-1.5 *:data-[slot=inline-editable-text-field]:py-0.5"
          maxLength={120}
          onBlur={() => {
            const name = draftName.trim();
            if (!name) return setDraftName(project.name);
            if (name !== project.name) onRename(name);
          }}
          onChange={setDraftName}
          value={draftName}
        />
        <SaveIndicator status={saveStatus} />
      </div>

      <div className="flex items-center gap-2">
        <Select
          items={aspectItems}
          onValueChange={(value) => value && onSettingsChange({ aspectRatio: value })}
          value={project.settings.aspectRatio}>
          <SelectTrigger aria-label={copy.aspectRatio} className="w-20 min-w-0 tabular-nums" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {aspectItems.map((item) => (
              <SelectItem className="tabular-nums" key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </div>

      <div className="flex items-center justify-end gap-1">
        <HistoryButton disabled={!canUndo} label={copy.undo} onClick={onUndo}>
          <RotateCcwIcon aria-hidden="true" />
        </HistoryButton>
        <HistoryButton disabled={!canRedo} label={copy.redo} onClick={onRedo}>
          <RotateCwIcon aria-hidden="true" />
        </HistoryButton>
        <Separator className="mx-1 h-5" orientation="vertical" />
        <PanelToggle
          hideLabel={STUDIO_COPY.layout.hidePrompt}
          onToggle={onTogglePrompt}
          pressed={promptOpen}
          showLabel={STUDIO_COPY.layout.showPrompt}
          side="start"
        />
        <PanelToggle
          hideLabel={STUDIO_COPY.layout.hideInspector}
          onToggle={onToggleInspector}
          pressed={inspectorOpen}
          showLabel={STUDIO_COPY.layout.showInspector}
          side="end"
        />
        <AppThemeToggle />
        <Separator className="mx-1 h-5" orientation="vertical" />
        <ComingSoonTooltip>
          <Button disabled size="sm">
            <DownloadIcon aria-hidden="true" />
            {copy.export}
          </Button>
        </ComingSoonTooltip>
      </div>
    </header>
  );
}
