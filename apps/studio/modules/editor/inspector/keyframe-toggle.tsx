"use client";

import { Toggle } from "@coss/ui/components/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import type { KeyframeState } from "./keyframe-state";
import { STUDIO_COPY } from "@/modules/studio-copy";

export function KeyframeToggle({
  label,
  state,
  onToggle,
}: {
  label: string;
  state: KeyframeState;
  onToggle: () => void;
}): React.ReactElement {
  const pressed = state === "at-playhead";
  const action = pressed ? STUDIO_COPY.inspector.removeKeyframe : STUDIO_COPY.inspector.addKeyframe;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            aria-label={`${label}: ${action}`}
            className="size-7 min-w-7 data-pressed:bg-transparent sm:size-7 sm:min-w-7"
            data-keyframe-state={state}
            data-testid="keyframe-toggle"
            onPressedChange={onToggle}
            pressed={pressed}
            size="sm"
          />
        }>
        <span
          aria-hidden="true"
          className={cn(
            "size-2.5 rotate-45 rounded-[2px] border-[1.5px] border-current",
            state === "none" && "text-muted-foreground/40",
            state === "elsewhere" && "text-foreground",
            state === "at-playhead" && "bg-current text-info"
          )}
        />
      </TooltipTrigger>
      <TooltipPopup>{action}</TooltipPopup>
    </Tooltip>
  );
}
