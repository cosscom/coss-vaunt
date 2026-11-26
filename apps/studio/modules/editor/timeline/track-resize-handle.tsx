"use client";

import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useRef, useState } from "react";
import { TRACK_MAX_HEIGHT_PX, TRACK_MIN_HEIGHT_PX } from "./track-heights";

const KEY_STEP_PX = 8;
const KEY_STEP_LARGE_PX = 32;

/**
 * An edge of the timeline as a splitter: a track row's bottom edge (`axis="y"`, its height) or the track header
 * column's right edge (`axis="x"`, its width). Drag it, or focus it and use the arrow keys (Shift for bigger steps),
 * to resize; double-click resets. A line lights while hovered, focused or dragged.
 */
export function TrackResizeHandle({
  label,
  value,
  onResize,
  onReset,
  axis = "y",
  min = TRACK_MIN_HEIGHT_PX,
  max = TRACK_MAX_HEIGHT_PX,
  className,
  style,
}: {
  label: string;
  value: number;
  onResize: (value: number) => void;
  onReset: () => void;
  axis?: "x" | "y";
  min?: number;
  max?: number;
  className?: string;
  style?: React.CSSProperties;
}): React.ReactElement {
  const drag = useRef<{ origin: number; start: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const horizontal = axis === "x";
  const coordinate = (event: React.PointerEvent) => (horizontal ? event.clientX : event.clientY);
  return (
    <div
      aria-label={label}
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={value}
      className={cn(
        "group/resize absolute z-25 touch-none outline-none",
        horizontal
          ? "inset-y-0 w-2 -translate-x-1/2 cursor-col-resize"
          : "inset-x-0 -bottom-1 h-2 cursor-row-resize",
        className
      )}
      data-dragging={dragging ? "" : undefined}
      data-testid={horizontal ? "track-header-resize" : "track-resize"}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        const step = event.shiftKey ? KEY_STEP_LARGE_PX : KEY_STEP_PX;
        const grow = horizontal ? "ArrowRight" : "ArrowDown";
        const shrink = horizontal ? "ArrowLeft" : "ArrowUp";
        if (event.key === grow) onResize(value + step);
        else if (event.key === shrink) onResize(value - step);
        else if (event.key === "Home") onResize(min);
        else if (event.key === "End") onResize(max);
        else return;
        event.preventDefault();
      }}
      onLostPointerCapture={() => {
        drag.current = null;
        setDragging(false);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { origin: coordinate(event), start: value };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        onResize(drag.current.start + coordinate(event) - drag.current.origin);
      }}
      onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
      role="separator"
      style={style}
      tabIndex={0}>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bg-info opacity-0 transition-opacity duration-150 group-hover/resize:opacity-100 group-focus-visible/resize:opacity-100",
          horizontal
            ? "inset-y-0 left-1/2 w-0.5 -translate-x-1/2"
            : "inset-x-0 top-1/2 h-0.5 -translate-y-1/2",
          dragging && "opacity-100"
        )}
      />
    </div>
  );
}
