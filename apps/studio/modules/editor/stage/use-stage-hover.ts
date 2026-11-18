import type * as React from "react";
import { useEffect, useRef, useState } from "react";

/** How long the pointer rests on a layer before it's selected. */
export const HOVER_SELECT_MS = 350;

/**
 * The layer under the pointer on the stage, and selecting it once the pointer rests there for
 * `HOVER_SELECT_MS`, so a canvas drag edits what you point at without switching tools.
 */
export function useStageHover({
  pick,
  selectedClipId,
  canSelect,
  onSelect,
}: {
  pick: (event: React.PointerEvent<HTMLElement>) => string | null;
  selectedClipId: string | null;
  /** False while dragging, playing or over the rotation gizmo. */
  canSelect: (event: React.PointerEvent<HTMLElement>) => boolean;
  onSelect: (clipId: string) => void;
}): {
  hoveredClipId: string | null;
  handlers: Pick<React.HTMLAttributes<HTMLElement>, "onPointerMove" | "onPointerLeave" | "onPointerDown">;
} {
  const [hoveredClipId, setHoveredClipId] = useState<string | null>(null);
  const hovered = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ onSelect, selectedClipId });
  latest.current = { onSelect, selectedClipId };

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const hover = (clipId: string | null) => {
    if (clipId === hovered.current) return;
    hovered.current = clipId;
    setHoveredClipId(clipId);
    cancel();
    if (!clipId || clipId === latest.current.selectedClipId) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      if (hovered.current === clipId) latest.current.onSelect(clipId);
    }, HOVER_SELECT_MS);
  };
  useEffect(() => cancel, []);

  return {
    hoveredClipId,
    handlers: {
      onPointerMove(event) {
        hover(canSelect(event) ? pick(event) : null);
      },
      onPointerLeave() {
        hover(null);
      },
      onPointerDown() {
        cancel();
      },
    },
  };
}
