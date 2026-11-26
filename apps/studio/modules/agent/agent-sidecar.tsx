"use client";

import { Button } from "@coss/ui/components/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { SparklesIcon, SquarePenIcon, XIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import type { RefObject } from "react";
import { AgentInput } from "./agent-input";
import { AgentThread } from "./agent-thread";
import type { AgentModel } from "./use-agent";
import { MirrorSplit } from "@/modules/editor/layout/mirror-split";
import type { PanelSize } from "@/modules/editor/layout/panel-resize";
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
  width,
  open,
  onClose,
  onOpenSettings,
  frameRef,
}: {
  agent: AgentModel;
  width: number;
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  frameRef: RefObject<HTMLElement | null>;
}): React.ReactElement {
  return (
    <section
      aria-label={copy.title}
      className={cn(
        "flex min-h-0 shrink-0 flex-col rounded-2xl p-1 transition-opacity duration-240 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
        !open && "opacity-0"
      )}
      data-slot="agent-frame"
      ref={frameRef}
      style={{ width }}>
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

/** The push: the column's width eases open and closed, so the editor makes room instead of being covered. */
const PUSH = "width 320ms cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * The agent beside the whole editor, on the window's right edge. It stays mounted while closed so opening and
 * closing can push the editor both ways; the frame keeps its width and is revealed from the window edge.
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
  const open = !size.collapsed;
  return (
    <div
      aria-hidden={!open}
      // Clipped only while it moves or is closed: open, the splitter's glow reaches one pixel past it onto the
      // editor's cards.
      className={cn("flex shrink-0 justify-end", (animating || !open) && "overflow-hidden")}
      data-slot="agent-sidecar"
      inert={!open}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget) onAnimationEnd();
      }}
      style={{ width: open ? size.size + gap : 0, transition: animating ? PUSH : undefined }}>
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
      <AgentFrame
        agent={agent}
        frameRef={frameRef}
        onClose={onClose}
        onOpenSettings={onOpenSettings}
        open={open}
        width={size.size}
      />
    </div>
  );
}
