"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { TRACK_HEADER_WIDTH_PX } from "./timeline-metrics";

export const TRACK_HEADER_MIN_WIDTH_PX = 140;
export const TRACK_HEADER_MAX_WIDTH_PX = 360;

const STORAGE_KEY = "studio.timeline-header-width.v1";

export function clampTrackHeaderWidth(width: number): number {
  return Math.round(Math.min(TRACK_HEADER_MAX_WIDTH_PX, Math.max(TRACK_HEADER_MIN_WIDTH_PX, width)));
}

/** The track header column's width, for the rows, the waveforms and drag autoscroll; the panel provides it. */
export const TrackHeaderWidthContext = createContext(TRACK_HEADER_WIDTH_PX);

export function useHeaderWidth(): number {
  return useContext(TrackHeaderWidthContext);
}

/** The column's width, which its right edge resizes; per person, in localStorage like the panel sizes. */
export function useTrackHeaderWidthState(): {
  width: number;
  setWidth: (width: number) => void;
  resetWidth: () => void;
} {
  const [width, setWidthState] = useState(TRACK_HEADER_WIDTH_PX);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(stored) && stored > 0) setWidthState(clampTrackHeaderWidth(stored));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (width === TRACK_HEADER_WIDTH_PX) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(width));
  }, [loaded, width]);

  const setWidth = useCallback((next: number) => setWidthState(clampTrackHeaderWidth(next)), []);
  const resetWidth = useCallback(() => setWidthState(TRACK_HEADER_WIDTH_PX), []);
  return { width, setWidth, resetWidth };
}
