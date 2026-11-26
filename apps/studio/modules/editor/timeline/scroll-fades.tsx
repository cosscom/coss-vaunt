"use client";

import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useEffect, useState } from "react";

const FADE_PX = 24;

type Edges = { top: boolean; bottom: boolean; left: boolean; right: boolean };

/** Which edges of `scroller` have more content beyond them, kept current as it scrolls or resizes. */
function useScrollEdges(
  scroller: React.RefObject<HTMLElement | null>,
  content: React.RefObject<HTMLElement | null>
): Edges {
  const [edges, setEdges] = useState<Edges>({ top: false, bottom: false, left: false, right: false });
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const { scrollTop, scrollLeft, scrollHeight, scrollWidth, clientHeight, clientWidth } = element;
      const next = {
        top: scrollTop > 1,
        bottom: scrollTop + clientHeight < scrollHeight - 1,
        left: scrollLeft > 1,
        right: scrollLeft + clientWidth < scrollWidth - 1,
      };
      setEdges((current) =>
        current.top === next.top &&
        current.bottom === next.bottom &&
        current.left === next.left &&
        current.right === next.right
          ? current
          : next
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    element.addEventListener("scroll", schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    if (content.current) observer.observe(content.current);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("scroll", schedule);
      observer.disconnect();
    };
  }, [scroller, content]);
  return edges;
}

/**
 * Soft fades over the timeline's lanes on each side where there's more to scroll to, inside the sticky ruler and
 * track headers so those stay crisp. Each fades in and out as its edge is reached.
 */
export function TimelineScrollFades({
  scroller,
  content,
  top,
  left,
}: {
  scroller: React.RefObject<HTMLElement | null>;
  content: React.RefObject<HTMLElement | null>;
  /** Where the lanes start: below the ruler, right of the track headers. */
  top: number;
  left: number;
}): React.ReactElement {
  const edges = useScrollEdges(scroller, content);
  const fade =
    "pointer-events-none absolute z-25 from-background to-transparent transition-opacity duration-150";
  return (
    <>
      <div
        aria-hidden="true"
        className={cn(fade, "right-0 bg-linear-to-b", edges.top ? "opacity-100" : "opacity-0")}
        style={{ top, left, height: FADE_PX }}
      />
      <div
        aria-hidden="true"
        className={cn(fade, "right-0 bottom-0 bg-linear-to-t", edges.bottom ? "opacity-100" : "opacity-0")}
        style={{ left, height: FADE_PX }}
      />
      <div
        aria-hidden="true"
        className={cn(fade, "bottom-0 bg-linear-to-r", edges.left ? "opacity-100" : "opacity-0")}
        style={{ top, left, width: FADE_PX }}
      />
      <div
        aria-hidden="true"
        className={cn(fade, "right-0 bottom-0 bg-linear-to-l", edges.right ? "opacity-100" : "opacity-0")}
        style={{ top, width: FADE_PX }}
      />
    </>
  );
}
