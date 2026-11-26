"use client";

import { Button } from "@coss/ui/components/button";
import { Toggle } from "@coss/ui/components/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import {
  ArrowLeftIcon,
  CheckIcon,
  CircleAlertIcon,
  LoaderIcon,
  PanelRightIcon,
  PanelRightOpenIcon,
  RotateCcwIcon,
  RotateCwIcon,
} from "@coss/ui/icons";
import { InlineEditableText } from "@coss/ui/shared/inline-editable-text";
import type { Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import Link from "next/link";
import type * as React from "react";
import { useState } from "react";
import { comboKeys, KEYMAP } from "./editor-keymap";
import { ExportButton } from "./export/export-dialog";
import { useIsMac } from "./use-is-mac";
import type { SaveStatus } from "./use-project-autosave";
import { SettingsButton } from "@/modules/settings/settings-button";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.editor;
const QUIET = "text-muted-foreground hover:text-foreground";

type ProjectBarProps = {
  project: Project;
  saveStatus: SaveStatus;
  onRename: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  promptOpen: boolean;
  inspectorOpen: boolean;
  agentOpen: boolean;
  onTogglePrompt: () => void;
  onToggleInspector: () => void;
  onToggleAgent: () => void;
};

function Tip({ label, children }: { label: string; children: React.ReactElement }): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

function PanelToggle({
  open,
  onToggle,
  showLabel,
  hideLabel,
  side,
}: {
  open: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
  side: "start" | "end";
}): React.ReactElement {
  const label = open ? hideLabel : showLabel;
  const Icon = open ? PanelRightIcon : PanelRightOpenIcon;
  return (
    <Tip label={label}>
      <Toggle
        aria-label={label}
        className={`size-7 min-w-7 sm:size-7 sm:min-w-7 ${QUIET}`}
        onPressedChange={onToggle}
        pressed={false}
        size="sm">
        <Icon aria-hidden="true" className={side === "start" ? "-scale-x-100" : undefined} />
      </Toggle>
    </Tip>
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
    <Tip label={label}>
      <span className="inline-flex">
        <Button
          aria-label={label}
          className={QUIET}
          disabled={disabled}
          onClick={onClick}
          size="icon-sm"
          variant="ghost">
          {children}
        </Button>
      </span>
    </Tip>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }): React.ReactElement {
  const label = { saved: copy.saved, saving: copy.saving, error: copy.saveFailed }[status];
  return (
    <span
      aria-live="polite"
      className="flex shrink-0 items-center gap-1 text-muted-foreground/72 text-xs data-[status=error]:text-destructive-foreground"
      data-status={status}
      data-tauri-drag-region
      data-testid="save-status">
      {status === "saved" ? <CheckIcon aria-hidden="true" className="size-3" /> : null}
      {status === "saving" ? <LoaderIcon aria-hidden="true" className="size-3 animate-spin" /> : null}
      {status === "error" ? <CircleAlertIcon aria-hidden="true" className="size-3" /> : null}
      {label}
    </span>
  );
}

/**
 * The editor's title bar. In the desktop window it is the window's own: it runs up under the macOS window buttons
 * (which the window centres in it), its empty space drags the window and a double-click zooms it.
 */
export function ProjectBar({
  project,
  saveStatus,
  onRename,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  promptOpen,
  inspectorOpen,
  agentOpen,
  onTogglePrompt,
  onToggleInspector,
  onToggleAgent,
}: ProjectBarProps): React.ReactElement {
  const [draftName, setDraftName] = useState(project.name);
  const mac = useIsMac();
  const agentKeys = comboKeys(
    KEYMAP.find((binding) => binding.action === "toggle-agent")?.combos[0] ?? {},
    mac
  );
  const agentLabel = `${agentOpen ? STUDIO_COPY.agent.hide : STUDIO_COPY.agent.show} (${agentKeys.join(mac ? "" : "+")})`;

  return (
    <header
      className="grid h-12 shrink-0 select-none grid-cols-[1fr_auto_1fr] items-center gap-4 ps-0.5 pe-0.5 [[data-vaunt-window]_&]:ps-[74px] [&_:is(button,a,[role=combobox])]:cursor-default"
      data-tauri-drag-region>
      <div className="flex min-w-0 items-center gap-1" data-tauri-drag-region>
        <PanelToggle
          hideLabel={STUDIO_COPY.layout.hidePrompt}
          onToggle={onTogglePrompt}
          open={promptOpen}
          showLabel={STUDIO_COPY.layout.showPrompt}
          side="start"
        />
        <Tip label={copy.backToProjects}>
          <Button
            aria-label={copy.backToProjects}
            className={QUIET}
            render={<Link href="/" />}
            size="icon-sm"
            variant="ghost">
            <ArrowLeftIcon aria-hidden="true" />
          </Button>
        </Tip>
        <InlineEditableText
          aria-label={copy.projectName}
          className="ms-1 min-w-0 font-medium text-[13px] *:data-[slot=inline-editable-text-edit]:hidden *:data-[slot=inline-editable-text-field]:rounded-md *:data-[slot=inline-editable-text-field]:px-1.5 *:data-[slot=inline-editable-text-field]:py-0.5"
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

      {/* The aspect ratio moved to the stage's toolbar; the middle of the bar stays a place to drag the window by. */}
      <div data-tauri-drag-region />

      <div className="flex items-center justify-end gap-0.5" data-tauri-drag-region>
        <HistoryButton disabled={!canUndo} label={copy.undo} onClick={onUndo}>
          <RotateCcwIcon aria-hidden="true" />
        </HistoryButton>
        <HistoryButton disabled={!canRedo} label={copy.redo} onClick={onRedo}>
          <RotateCwIcon aria-hidden="true" />
        </HistoryButton>
        <span aria-hidden="true" className="mx-1.5 h-4 w-px bg-border" />
        <Tip label={agentLabel}>
          <Toggle
            aria-label={agentOpen ? STUDIO_COPY.agent.hide : STUDIO_COPY.agent.show}
            className={`h-7 px-2 ${QUIET} data-pressed:text-foreground`}
            onPressedChange={onToggleAgent}
            pressed={agentOpen}
            size="sm">
            <span className="text-[13px]">{STUDIO_COPY.agent.title}</span>
          </Toggle>
        </Tip>
        <SettingsButton className={QUIET} />
        <PanelToggle
          hideLabel={STUDIO_COPY.layout.hideInspector}
          onToggle={onToggleInspector}
          open={inspectorOpen}
          showLabel={STUDIO_COPY.layout.showInspector}
          side="end"
        />
        <span className="ms-1.5">
          <ExportButton project={project} saveStatus={saveStatus} />
        </span>
      </div>
    </header>
  );
}
