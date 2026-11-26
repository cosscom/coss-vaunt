"use client";

import { Toggle } from "@coss/ui/components/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { LockIcon, LockOpenIcon } from "@coss/ui/icons";
import type * as React from "react";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.timeline;

/** The track header's lock: pressed while the track's clips can't be selected or edited. */
export function TrackLockToggle({
  name,
  locked,
  onToggle,
}: {
  name: string;
  locked: boolean;
  onToggle: () => void;
}): React.ReactElement {
  const label = locked ? copy.unlockTrack(name) : copy.lockTrack(name);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            aria-label={label}
            className="size-6 min-w-6 sm:size-6 sm:min-w-6"
            data-testid="track-lock"
            onPressedChange={onToggle}
            pressed={locked}
            size="sm"
          />
        }>
        {locked ? (
          <LockIcon aria-hidden="true" />
        ) : (
          <LockOpenIcon aria-hidden="true" className="text-muted-foreground/72" />
        )}
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}
