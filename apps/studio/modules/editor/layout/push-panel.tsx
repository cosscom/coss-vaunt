"use client";

import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";

/** The push: the column's width eases open and closed, so the editor makes room instead of being covered. */
const PUSH = "width 320ms cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * A side panel that pushes the editor open and closed: the agent's sidecar, the storyboard panel and the inspector.
 * It stays mounted while closed so both directions can ease. The column's width eases (only after a toggle; dragging
 * the splitter tracks the pointer) while the content keeps its width and fades, so it's revealed from the `edge` it
 * sits against rather than squeezed. The splitter sits on the side facing the editor.
 */
export function PushPanel({
  edge,
  open,
  size,
  gap,
  animating,
  onAnimationEnd,
  splitter,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  /** The window side the panel is anchored to and revealed from. */
  edge: "start" | "end";
  open: boolean;
  /** The content's width, in px; the column adds the gap for the splitter. */
  size: number;
  gap: number;
  /** Set by a toggle, so only opening and closing ease. */
  animating: boolean;
  onAnimationEnd: () => void;
  splitter: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      aria-hidden={!open}
      // Clipped only while it moves or is closed: open, the splitter's glow reaches one pixel past it onto the
      // editor's cards.
      className={cn(
        "flex min-h-0 shrink-0",
        edge === "end" ? "justify-end" : "justify-start",
        (animating || !open) && "overflow-hidden"
      )}
      inert={!open}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget) onAnimationEnd();
      }}
      style={{ width: open ? size + gap : 0, transition: animating ? PUSH : undefined }}
      {...props}>
      {edge === "end" ? splitter : null}
      <div
        className={cn(
          "flex min-h-0 shrink-0 flex-col transition-opacity duration-240 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
          !open && "opacity-0",
          className
        )}
        style={{ width: size }}>
        {children}
      </div>
      {edge === "start" ? splitter : null}
    </div>
  );
}
