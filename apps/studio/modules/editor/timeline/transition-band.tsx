"use client";

import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import type { TransitionRegion } from "./transition-regions";
import { STUDIO_COPY } from "@/modules/studio-copy";

const LABEL_MIN_WIDTH_PX = 64;

/** Sits over the overlap of two clips; the clips' trim handles stay above it. */
export function TransitionBand({
  region,
  left,
  width,
  selected,
  locked = false,
  onSelect,
}: {
  region: TransitionRegion;
  left: number;
  width: number;
  selected: boolean;
  /** On a locked track: drawn muted and can't be selected. */
  locked?: boolean;
  onSelect: () => void;
}): React.ReactElement {
  const label = STUDIO_COPY.transitions[region.kind];
  return (
    <button
      aria-label={STUDIO_COPY.timeline.transitionLabel(label)}
      className={cn(
        "absolute inset-y-1.5 z-2 flex cursor-pointer items-center justify-center overflow-hidden rounded-md border border-foreground/24 bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--color-foreground)_14%,transparent)_0_1px,transparent_1px_6px)] bg-background text-[0.625rem] text-foreground outline-none hover:border-foreground/48 focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-foreground/64",
        locked && "pointer-events-none opacity-72"
      )}
      data-clip-id={region.clipId}
      data-menu={locked ? undefined : "transition"}
      disabled={locked}
      data-testid="transition-band"
      onClick={onSelect}
      onPointerDown={(event) => event.stopPropagation()}
      style={{ left, width }}
      title={label}
      type="button">
      {width >= LABEL_MIN_WIDTH_PX ? (
        <span className="truncate rounded-sm bg-background px-1 font-medium leading-4">{label}</span>
      ) : null}
    </button>
  );
}
