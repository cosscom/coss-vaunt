"use client";

import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { STUDIO_COPY } from "@/modules/studio-copy";

/** Disabled buttons swallow pointer events, so the tooltip anchors on a wrapper. */
export function ComingSoonTooltip({
  children,
  label = STUDIO_COPY.comingSoon,
  className,
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={cn("inline-flex", className)} />}>{children}</TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}
