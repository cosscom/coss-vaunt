"use client";

import { Button } from "@coss/ui/components/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { RotateCcwIcon } from "@coss/ui/icons";
import type * as React from "react";

/** The reset at the end of an inspector section's header. */
export function SectionResetButton({
  label,
  onReset,
}: {
  label: string;
  onReset: () => void;
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button aria-label={label} onClick={onReset} size="icon-xs" variant="ghost" />}>
        <RotateCcwIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}
