"use client";

import { Button } from "@coss/ui/components/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { SparklesIcon, SquarePenIcon, XIcon } from "@coss/ui/icons";
import type * as React from "react";
import type { RefObject } from "react";
import { AgentInput } from "./agent-input";
import { AgentThread } from "./agent-thread";
import type { AgentModel } from "./use-agent";
import { MirrorSplit } from "@/modules/editor/layout/mirror-split";
import type { PanelSize } from "@/modules/editor/layout/panel-resize";
import { PushPanel } from "@/modules/editor/layout/push-panel";
import { PANEL_SPECS } from "@/modules/editor/layout/use-panel-layout";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.agent;

function FrameAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            className="text-muted-foreground hover:text-foreground"
            onClick={onClick}
            size="icon-xs"
            type="button"
            variant="ghost"
          />
        }>
        {children}
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

/**
 * The agent's own material: the composer frame's muted shell with the header on it, holding an inset card for the
 * thread, with the composer on the frame under it. It reads as something attached to the editor, not a panel of it.
 */
function AgentFrame({
  agent,
  onClose,
  onOpenSettings,
  frameRef,
}: {
  agent: AgentModel;
  onClose: () => void;
  onOpenSettings: () => void;
  frameRef: RefObject<HTMLElement | null>;
}): React.ReactElement {
  return (
    <section
      aria-label={copy.title}
      className="flex min-h-0 flex-1 flex-col rounded-2xl p-1"
      data-slot="agent-frame"
      ref={frameRef}>
      <header className="flex h-9 shrink-0 items-center gap-1.5 ps-2.5 pe-1">
        <SparklesIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
        <h2 className="min-w-0 flex-1 truncate font-medium text-[13px]">{copy.title}</h2>
        {agent.thread.messages.length > 0 ? (
          <FrameAction label={copy.newChat} onClick={agent.thread.clear}>
            <SquarePenIcon aria-hidden="true" />
          </FrameAction>
        ) : null}
        <FrameAction label={copy.close} onClick={onClose}>
          <XIcon aria-hidden="true" />
        </FrameAction>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background">
        <AgentThread agent={agent} />
      </div>
      <AgentInput agent={agent} className="shrink-0 pt-1" onOpenSettings={onOpenSettings} />
    </section>
  );
}

/**
 * The agent beside the whole editor, on the window's right edge. It pushes the editor open and closed like the
 * editor's own side panels; the frame is revealed from the window edge.
 */
export function AgentSidecar({
  agent,
  size,
  onSizeChange,
  onReset,
  animating,
  onAnimationEnd,
  onClose,
  onOpenSettings,
  frameRef,
  gap,
}: {
  agent: AgentModel;
  size: PanelSize;
  onSizeChange: (size: PanelSize) => void;
  onReset: () => void;
  /** Set by a toggle, so only opening and closing ease; dragging the splitter tracks the pointer. */
  animating: boolean;
  onAnimationEnd: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
  frameRef: RefObject<HTMLElement | null>;
  gap: number;
}): React.ReactElement {
  return (
    <PushPanel
      animating={animating}
      data-slot="agent-sidecar"
      edge="end"
      gap={gap}
      onAnimationEnd={onAnimationEnd}
      open={!size.collapsed}
      size={size.size}
      splitter={
        <MirrorSplit
          direction={-1}
          gap={gap}
          label={copy.resize}
          onChange={onSizeChange}
          onReset={onReset}
          orientation="vertical"
          spec={PANEL_SPECS.agent}
          value={size}
        />
      }>
      <AgentFrame agent={agent} frameRef={frameRef} onClose={onClose} onOpenSettings={onOpenSettings} />
    </PushPanel>
  );
}
