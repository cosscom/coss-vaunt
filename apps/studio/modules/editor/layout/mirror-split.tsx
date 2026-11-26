"use client";

import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { cardSegments, segmentMask } from "./card-edge";
import { dragPanelSize, type PanelSize, type PanelSpec, releasePanel, resizePanel } from "./panel-resize";
import { PointerGlowEdge, usePointerGlow } from "@/modules/agent-ui/pointer-glow";

const KEY_STEP_PX = 16;
const KEY_STEP_LARGE_PX = 64;
const SPRING_BACK_MS = 250;
/** Cards a gap's glow may light carry this attribute. */
export const EDITOR_CARD_ATTRIBUTE = "data-editor-card";

type MirrorSplitProps = {
  /** `vertical` is a gap between columns, `horizontal` a gap between rows. */
  orientation: "vertical" | "horizontal";
  label: string;
  spec: PanelSpec;
  value: PanelSize;
  /** +1 when moving the handle right or down grows the panel, -1 when it shrinks it. */
  direction: 1 | -1;
  onChange: (size: PanelSize) => void;
  onReset: () => void;
  /** The gap's width, in px. */
  gap: number;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function rectOf(element: Element) {
  const { left, top, right, bottom } = element.getBoundingClientRect();
  return { left, top, right, bottom };
}

/**
 * The gap between two cards, as a splitter. Nothing is drawn in it: hovering or dragging lights the facing borders
 * of the cards on both sides, mirrored, and only where a card (`data-editor-card`) sits against the gap, so the glow
 * skips the gaps between cards and stops before their rounded corners. Drag it (past a limit it rubber-bands, then
 * springs back), use the arrow keys when focused, or double-click to reset; releasing a collapsible panel well below
 * its minimum collapses it.
 */
export function MirrorSplit({
  orientation,
  label,
  spec,
  value,
  direction,
  onChange,
  onReset,
  gap,
}: MirrorSplitProps): React.ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<{ origin: number; start: number } | null>(null);
  const spring = useRef(0);
  const glow = usePointerGlow();
  const [dragging, setDragging] = useState(false);
  const [masks, setMasks] = useState<{ before: string; after: string } | null>(null);
  const vertical = orientation === "vertical";
  const current = value.collapsed ? 0 : value.size;
  const coordinate = (event: React.PointerEvent) => (vertical ? event.clientX : event.clientY);

  useEffect(() => () => cancelAnimationFrame(spring.current), []);

  // Measured when the glow shows and as a drag moves the cards, not on every render.
  const measure = () => {
    if (!host.current) return;
    const gapRect = rectOf(host.current);
    // A closed side panel stays mounted (inert, clipped to nothing), so its card doesn't count.
    const cards = [...document.querySelectorAll(`[${EDITOR_CARD_ATTRIBUTE}]`)]
      .filter((card) => !card.closest("[inert]"))
      .map(rectOf);
    setMasks({
      before: segmentMask(cardSegments(gapRect, cards, vertical, "before"), vertical),
      after: segmentMask(cardSegments(gapRect, cards, vertical, "after"), vertical),
    });
  };

  const springTo = (from: number, to: PanelSize) => {
    if (to.collapsed || prefersReducedMotion() || Math.abs(from - to.size) < 0.5) {
      onChange(to);
      return;
    }
    const started = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / SPRING_BACK_MS);
      const eased = 1 - (1 - progress) ** 3;
      onChange({ size: from + (to.size - from) * eased, collapsed: false });
      if (progress < 1) spring.current = requestAnimationFrame(step);
    };
    spring.current = requestAnimationFrame(step);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? KEY_STEP_LARGE_PX : KEY_STEP_PX;
    const keys: Record<string, number> = vertical
      ? { ArrowLeft: -step, ArrowRight: step }
      : { ArrowUp: -step, ArrowDown: step };
    if (event.key === "Home") onChange({ size: spec.min, collapsed: false });
    else if (event.key === "End") onChange({ size: spec.max, collapsed: false });
    else if (event.key === "Enter" && spec.collapsible) onChange({ ...value, collapsed: !value.collapsed });
    else if (keys[event.key] !== undefined)
      onChange(resizePanel(spec, value.size, (keys[event.key] ?? 0) * direction));
    else return;
    event.preventDefault();
  };

  const lit = (glow.isLit || dragging) && masks !== null;
  // A card's border is its outermost pixel, so each line overlaps the gap's edge by one pixel.
  const edge = vertical ? "inset-y-0 w-px" : "inset-x-0 h-px";

  return (
    <div
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemax={spec.max}
      aria-valuemin={spec.collapsible ? 0 : spec.min}
      aria-valuenow={Math.round(current)}
      className={cn(
        "group relative z-30 shrink-0 touch-none select-none outline-none",
        vertical ? "cursor-col-resize" : "cursor-row-resize"
      )}
      data-slot="resize-handle"
      data-testid={`split-${label}`}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        cancelAnimationFrame(spring.current);
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { origin: coordinate(event), start: current };
        setDragging(true);
        measure();
      }}
      onPointerEnter={(event) => {
        measure();
        glow.handlers.onPointerEnter(event);
      }}
      onPointerLeave={glow.handlers.onPointerLeave}
      onPointerMove={(event) => {
        glow.handlers.onPointerMove(event);
        if (!drag.current) return;
        const delta = (coordinate(event) - drag.current.origin) * direction;
        onChange({ size: dragPanelSize(spec, drag.current.start, delta), collapsed: false });
        measure();
      }}
      onPointerUp={(event) => {
        if (!drag.current) return;
        const { start, origin } = drag.current;
        const delta = (coordinate(event) - origin) * direction;
        drag.current = null;
        setDragging(false);
        springTo(dragPanelSize(spec, start, delta), releasePanel(spec, start, delta));
      }}
      ref={host}
      role="separator"
      style={vertical ? { width: gap } : { height: gap }}
      tabIndex={0}>
      {(["before", "after"] as const).map((side) => {
        let placement = vertical ? "-end-px" : "-bottom-px";
        if (side === "before") placement = vertical ? "-start-px" : "-top-px";
        const mask = masks?.[side];
        return (
          <span
            aria-hidden="true"
            className={cn("pointer-events-none absolute", edge, placement)}
            key={side}
            style={{ maskImage: mask, WebkitMaskImage: mask }}>
            <PointerGlowEdge axis={vertical ? "y" : "x"} className="inset-0" isLit={lit} />
          </span>
        );
      })}
      {/* Keyboard focus: a quiet bar in the middle of the gap. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute rounded-full bg-ring opacity-0 group-focus-visible:opacity-100",
          vertical ? "inset-y-6 start-1/2 w-0.5 -translate-x-1/2" : "inset-x-6 top-1/2 h-0.5 -translate-y-1/2"
        )}
      />
    </div>
  );
}
