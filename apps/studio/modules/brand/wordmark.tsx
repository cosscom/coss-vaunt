import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { WORDMARK_COSS_PATH, WORDMARK_MOTION_PATH, WORDMARK_VIEWBOX } from "./wordmark-outline";
import { STUDIO_COPY } from "@/modules/studio-copy";

const { x, y, width, height } = WORDMARK_VIEWBOX;

/** The “coss motion” logo; sized by its height, with “motion” muted. */
export function Wordmark({
  className,
  cossClassName = "text-foreground",
  motionClassName = "text-muted-foreground/64",
  ...props
}: React.ComponentProps<"svg"> & { cossClassName?: string; motionClassName?: string }): React.ReactElement {
  return (
    <svg
      aria-label={STUDIO_COPY.appName}
      className={cn("h-5 w-auto shrink-0", className)}
      role="img"
      viewBox={`${x} ${y} ${width} ${height}`}
      {...props}>
      <path className={cossClassName} d={WORDMARK_COSS_PATH} fill="currentColor" />
      <path className={motionClassName} d={WORDMARK_MOTION_PATH} fill="currentColor" />
    </svg>
  );
}
