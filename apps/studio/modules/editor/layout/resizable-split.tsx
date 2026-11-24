"use client";

import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useEffect, useRef } from "react";
import { dragPanelSize, type PanelSize, type PanelSpec, releasePanel, resizePanel } from "./panel-resize";
import { PointerGlowEdge, usePointerGlow } from "@/modules/agent-ui/pointer-glow";

const KEY_STEP_PX = 16;
const KEY_STEP_LARGE_PX = 64;
const SPRING_BACK_MS = 250;

type ResizableSplitProps = {
  /** `vertical` is a line between columns, `horizontal` a line between rows. */
  orientation: "vertical" | "horizontal";
  label: string;
  spec: PanelSpec;
  value: PanelSize;
  /** +1 when moving the handle right or down grows the panel, -1 when it shrinks it. */
  direction: 1 | -1;
  onChange: (size: PanelSize) => void;
  onReset: () => void;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A splitter between two panes, lit like the Agent panel's resize edges. Drag it (past a limit it
 * rubber-bands, then springs back on release), use the arrow keys when focused, or double-click to
 * reset. Releasing a collapsible panel well below its minimum collapses it.
 */
export function ResizableSplit({
  orientation,
  label,
  spec,
  value,
  direction,
  onChange,
  onReset,
}: ResizableSplitProps): React.ReactElement {
  const drag = useRef<{ origin: number; start: number; shown: number } | null>(null);
  const spring = useRef(0);
  const glow = usePointerGlow();
  const vertical = orientation === "vertical";
  const current = value.collapsed ? 0 : value.size;
  const coordinate = (event: React.PointerEvent) => (vertical ? event.clientX : event.clientY);

  useEffect(() => () => cancelAnimationFrame(spring.current), []);

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

  return (
    <div
      className={cn("relative z-40 shrink-0 bg-border", vertical ? "w-px" : "h-px")}
      data-testid={`split-${label}`}>
      <div
        aria-label={label}
        aria-orientation={orientation}
        aria-valuemax={spec.max}
        aria-valuemin={spec.collapsible ? 0 : spec.min}
        aria-valuenow={Math.round(current)}
        className={cn(
          "group absolute touch-none select-none outline-none",
          vertical ? "inset-y-0 -start-1 w-3 cursor-col-resize" : "inset-x-0 -top-1 h-3 cursor-row-resize"
        )}
        data-slot="resize-handle"
        onDoubleClick={onReset}
        onKeyDown={onKeyDown}
        role="separator"
        tabIndex={0}
        {...glow.handlers}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          cancelAnimationFrame(spring.current);
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { origin: coordinate(event), start: current, shown: current };
        }}
        onPointerMove={(event) => {
          glow.handlers.onPointerMove(event);
          if (!drag.current) return;
          const shown = dragPanelSize(
            spec,
            drag.current.start,
            (coordinate(event) - drag.current.origin) * direction
          );
          drag.current.shown = shown;
          onChange({ size: shown, collapsed: false });
        }}
        onPointerUp={(event) => {
          if (!drag.current) return;
          const { start, origin, shown } = drag.current;
          drag.current = null;
          springTo(shown, releasePanel(spec, start, (coordinate(event) - origin) * direction));
        }}>
        <PointerGlowEdge
          axis={vertical ? "y" : "x"}
          className={vertical ? "inset-y-0 start-1 w-px" : "inset-x-0 top-1 h-px"}
          isLit={glow.isLit}
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute rounded-full bg-ring opacity-0 group-focus-visible:opacity-100",
            vertical ? "inset-y-3 start-[3px] w-0.5" : "inset-x-3 top-[3px] h-0.5"
          )}
        />
      </div>
    </div>
  );
}
