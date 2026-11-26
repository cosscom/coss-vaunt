"use client";

import { ClockIcon, FileTextIcon, LayersIcon, VideoIcon, XIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import type { ContextChip } from "./agent-context";
import { ModelPicker } from "./model-picker";
import type { AgentModel } from "./use-agent";
import { AgentComposer } from "@/modules/agent-ui/agent-composer";
import { BorderBeam } from "@/modules/border-beam/border-beam";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.agent;
const CHIP_ICONS = { project: LayersIcon, scene: FileTextIcon, clip: VideoIcon, moment: ClockIcon } as const;

function Chip({ chip, onRemove }: { chip: ContextChip; onRemove?: () => void }): React.ReactElement {
  const Icon = CHIP_ICONS[chip.kind];
  return (
    <span className="inline-flex h-6 max-w-44 items-center gap-1.5 rounded-[calc(var(--agent-composer-radius,8px)-2px)] bg-muted ps-2 pe-1 text-muted-foreground text-xs">
      <Icon aria-hidden="true" className="size-3 shrink-0 opacity-72" />
      <span className={cn("min-w-0 truncate", chip.kind === "moment" && "tabular-nums")}>{chip.label}</span>
      {onRemove ? (
        <button
          aria-label={copy.removeContext(chip.label)}
          className="relative -me-0.5 grid size-5 shrink-0 place-items-center rounded-sm before:absolute before:-inset-1 hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          onClick={onRemove}
          type="button">
          <XIcon aria-hidden="true" className="size-3" />
        </button>
      ) : (
        <span aria-hidden="true" className="w-1" />
      )}
    </span>
  );
}

/** The agent's composer: what's in context as chips in its header, the model under the input. */
export function AgentInput({
  agent,
  onOpenSettings,
  className,
}: {
  agent: AgentModel;
  onOpenSettings: () => void;
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        // The composer's chip shelf sits 2 px around it, so the composer is 2 px tighter than the card's curve.
        "[--agent-composer-radius:calc(var(--radius-xl)-1px-4px-2px)]",
        // Its bottom corners sit nearer the card's, so they open 1 px wider to read as parallel to the card's curve.
        "**:data-[slot=composer]:rounded-b-[calc(var(--agent-composer-radius)+1px)]",
        className
      )}>
      <BorderBeam state={agent.busy ? "active" : "idle"}>
        <AgentComposer
          autoFocus={false}
          header={
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {agent.chips.map((chip) => (
                <Chip
                  chip={chip}
                  key={chip.id}
                  onRemove={chip.kind === "project" ? undefined : () => agent.dismiss(chip.id)}
                />
              ))}
            </div>
          }
          headerOpen
          inputLabel={copy.inputLabel}
          isBusy={agent.busy}
          leadingActions={<ModelPicker onOpenSettings={onOpenSettings} />}
          onStop={agent.thread.stop}
          onSubmit={() => agent.ask(agent.draft)}
          onValueChange={agent.setDraft}
          placeholder={copy.placeholder}
          rows={2}
          sendLabel={copy.send}
          stopLabel={copy.stop}
          value={agent.draft}
        />
      </BorderBeam>
    </div>
  );
}
