"use client";

import { Field, FieldLabel } from "@coss/ui/components/field";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@coss/ui/components/number-field";
import { Popover, PopoverPopup, PopoverTrigger } from "@coss/ui/components/popover";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@coss/ui/components/select";
import { cn } from "@coss/ui/lib/utils";
import {
  MAX_TRANSITION_SECONDS,
  TRANSITION_KINDS,
  type TransitionKind,
} from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getSmoothStepPath } from "@xyflow/react";
import type * as React from "react";
import { createContext, useContext } from "react";
import type { TransitionFlowEdge } from "./board-flow";
import type { StoryboardActions } from "./use-storyboard-actions";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.storyboard;
const transitionItems = TRANSITION_KINDS.map((kind) => ({
  value: kind,
  label: STUDIO_COPY.transitions[kind],
}));

/** React Flow renders edges from `edgeTypes`, so the actions reach them through context rather than props. */
export const EdgeActionsContext = createContext<StoryboardActions | null>(null);

export function TransitionEdge({
  id,
  data,
  selected,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps<TransitionFlowEdge>): React.ReactElement {
  const actions = useContext(EdgeActionsContext);
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  });
  const edge = data?.edge;
  if (!edge) return <BaseEdge id={id} path={path} />;
  const kind = STUDIO_COPY.transitions[edge.transition];
  const seconds = copy.seconds(edge.transitionSeconds);
  const cut = edge.transition === "cut";

  return (
    <>
      <BaseEdge id={id} interactionWidth={16} path={path} />
      <EdgeLabelRenderer>
        <Popover>
          <PopoverTrigger
            aria-label={copy.edge.label(kind, seconds)}
            className={cn(
              "nodrag nopan pointer-events-auto absolute cursor-pointer whitespace-nowrap rounded-full border bg-background px-2 py-0.5 text-muted-foreground text-xs shadow-xs/5 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-popup-open:border-ring data-popup-open:text-foreground",
              selected && "border-ring text-foreground"
            )}
            data-board-edge={edge.id}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
            {cut ? kind : `${kind} · ${seconds}`}
          </PopoverTrigger>
          <PopoverPopup className="w-56" side="right">
            <div className="flex flex-col gap-3">
              <Field>
                <FieldLabel>{copy.edge.kind}</FieldLabel>
                <Select
                  items={transitionItems}
                  onValueChange={(next: TransitionKind | null) =>
                    next && actions?.updateEdge(edge.id, (current) => ({ ...current, transition: next }))
                  }
                  value={edge.transition}>
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {transitionItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </Field>
              <Field disabled={cut}>
                <FieldLabel>{copy.edge.length}</FieldLabel>
                <NumberField
                  disabled={cut}
                  format={{ style: "unit", unit: "second", unitDisplay: "narrow", maximumFractionDigits: 2 }}
                  max={MAX_TRANSITION_SECONDS}
                  min={0}
                  onValueChange={(next) =>
                    next !== null &&
                    actions?.updateEdge(
                      edge.id,
                      (current) => ({ ...current, transitionSeconds: next }),
                      `edge-length:${edge.id}`
                    )
                  }
                  size="sm"
                  step={0.25}
                  value={edge.transitionSeconds}>
                  <NumberFieldGroup>
                    <NumberFieldDecrement />
                    <NumberFieldInput />
                    <NumberFieldIncrement />
                  </NumberFieldGroup>
                </NumberField>
              </Field>
            </div>
          </PopoverPopup>
        </Popover>
      </EdgeLabelRenderer>
    </>
  );
}
