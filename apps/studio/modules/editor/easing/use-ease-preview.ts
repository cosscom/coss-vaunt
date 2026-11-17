"use client";

import { useEffect, useRef, useState } from "react";

const PREVIEW_MS = 1000;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Linear time from 0 to 1 over a second, or null when idle; reduced motion skips straight to the end. */
export function useEasePreview(): { time: number | null; play: () => void } {
  const [time, setTime] = useState<number | null>(null);
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const play = () => {
    cancelAnimationFrame(frame.current);
    if (prefersReducedMotion()) {
      setTime(1);
      return;
    }
    const startedAt = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - startedAt) / PREVIEW_MS);
      setTime(elapsed);
      if (elapsed < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  return { time, play };
}
