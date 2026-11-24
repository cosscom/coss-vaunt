"use client";

import { cn } from "@coss/ui/lib/utils";
import type { CSSProperties, PointerEvent, ReactElement } from "react";
import { useState } from "react";

type PointerGlowHandlers = {
  onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
};

/** How far along the border the bright core, and the softer halo under it, reach from the pointer. */
const CORE_REACH_PX = 150;
const HALO_REACH_PX = 150;
/** Both ends of a single lit edge ramp up over this distance, so a glow near a corner shows no cut edge. */
const EDGE_FADE_PX = 48;

/**
 * A pointer-centred radial gradient, eased over three stops so the lit stretch of border fades out
 * instead of ending on the gradient's own edge. The pointer's position comes from the host.
 */
function glowGradient(reachPx: number, corePercent: number, midPercent: number, at: string): string {
  return (
    `radial-gradient(${reachPx}px circle at ${at}, ` +
    `color-mix(in oklab, var(--foreground) ${corePercent}%, transparent) 0%, ` +
    `color-mix(in oklab, var(--foreground) ${midPercent}%, transparent) 45%, ` +
    "transparent 100%)"
  );
}

/** Follows the pointer on both axes, for a glow that wraps a whole host. */
const RING_ORIGIN = "var(--pointer-glow-x, -100%) var(--pointer-glow-y, -100%)";

/**
 * Two full masks, one clipped to the content box, subtracted: only the padding band keeps the paint,
 * which is what puts the glow on the border line. `mask-image` takes no box keyword, so the clip is
 * its own property.
 */
const BAND_MASK: CSSProperties = {
  maskImage: "linear-gradient(#000 0 0), linear-gradient(#000 0 0)",
  maskClip: "content-box, border-box",
  maskComposite: "exclude",
  WebkitMaskImage: "linear-gradient(#000 0 0), linear-gradient(#000 0 0)",
  WebkitMaskClip: "content-box, border-box",
  WebkitMaskComposite: "xor",
};

/**
 * Whether the pointer is over a host element, for `PointerGlowOverlay`; spread `handlers` onto that
 * host. The pointer's position is written to the host's custom properties rather than to state, so
 * moving across the host never re-renders it.
 */
export function usePointerGlow(): { isLit: boolean; handlers: PointerGlowHandlers } {
  const [isLit, setIsLit] = useState(false);

  const track = (event: PointerEvent<HTMLElement>): void => {
    const host = event.currentTarget;
    const rect = host.getBoundingClientRect();
    host.style.setProperty("--pointer-glow-x", `${event.clientX - rect.left}px`);
    host.style.setProperty("--pointer-glow-y", `${event.clientY - rect.top}px`);
    setIsLit(true);
  };

  return {
    isLit,
    handlers: {
      onPointerEnter: track,
      onPointerMove: track,
      onPointerLeave: (): void => setIsLit(false),
    },
  };
}

/**
 * Lights the host's border around the pointer: a one-pixel core on the border line, over a blurred
 * band that spills either side of it. The host must be positioned and carry the radius, which the
 * overlay inherits.
 */
export function PointerGlowOverlay({ isLit }: { isLit: boolean }): ReactElement {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] opacity-0 transition-opacity duration-200 ease-out data-[state=on]:opacity-100"
      data-slot="pointer-glow"
      data-state={isLit ? "on" : "off"}>
      {/* Masked first and blurred by the wrapper, so the halo spreads from the band instead of being cut flat. */}
      <span className="absolute inset-0 rounded-[inherit] opacity-64 blur-[3px]">
        <span
          className="absolute inset-0 rounded-[inherit] p-0.5"
          style={{ ...BAND_MASK, backgroundImage: glowGradient(HALO_REACH_PX, 36, 12, RING_ORIGIN) }}
        />
      </span>
      <span
        className="absolute inset-0 rounded-[inherit] p-px"
        style={{ ...BAND_MASK, backgroundImage: glowGradient(CORE_REACH_PX, 58, 20, RING_ORIGIN) }}
      />
    </span>
  );
}

/**
 * The same glow on one straight edge, for a host whose border a parent owns — a resize handle lying
 * over a popup's border. `className` places and sizes the line; it travels along `axis`, and stays
 * clear of the corner radius so it never cuts across one.
 */
export function PointerGlowEdge({
  axis,
  className,
  isLit,
}: {
  axis: "x" | "y";
  className?: string;
  isLit: boolean;
}): ReactElement {
  const along = axis === "x" ? "to right" : "to bottom";
  const origin = axis === "x" ? "var(--pointer-glow-x, -100%) 50%" : "50% var(--pointer-glow-y, -100%)";
  const endFade =
    `linear-gradient(${along}, transparent var(--radius-lg), ` +
    `#000 calc(var(--radius-lg) + ${EDGE_FADE_PX}px), ` +
    `#000 calc(100% - var(--radius-lg) - ${EDGE_FADE_PX}px), ` +
    "transparent calc(100% - var(--radius-lg)))";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute opacity-0 transition-opacity duration-200 ease-out data-[state=on]:opacity-100",
        className
      )}
      data-slot="pointer-glow"
      data-state={isLit ? "on" : "off"}
      // Masking the wrapper fades the blurred halo with the line, instead of leaving it past the corner.
      style={{ maskImage: endFade, WebkitMaskImage: endFade }}>
      <span
        className="absolute inset-0 opacity-64 blur-[2px]"
        style={{ backgroundImage: glowGradient(HALO_REACH_PX, 36, 12, origin) }}
      />
      <span
        className="absolute inset-0"
        style={{ backgroundImage: glowGradient(CORE_REACH_PX, 58, 20, origin) }}
      />
    </span>
  );
}
