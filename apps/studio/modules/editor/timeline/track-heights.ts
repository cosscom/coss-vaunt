"use client";

import { useCallback, useEffect, useState } from "react";

export const TRACK_MIN_HEIGHT_PX = 32;
export const TRACK_MAX_HEIGHT_PX = 200;

const STORAGE_KEY = "studio.timeline-track-heights.v1";

export type TrackHeights = Readonly<Record<string, number>>;

export function clampTrackHeight(height: number): number {
  return Math.round(Math.min(TRACK_MAX_HEIGHT_PX, Math.max(TRACK_MIN_HEIGHT_PX, height)));
}

/** Keeps only well-formed entries from whatever localStorage held. */
export function restoreTrackHeights(stored: unknown): TrackHeights {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return {};
  return Object.fromEntries(
    Object.entries(stored).flatMap(([id, height]) =>
      typeof height === "number" && Number.isFinite(height) ? [[id, clampTrackHeight(height)]] : []
    )
  );
}

/**
 * Each track's height, keyed by track id. Like the panel sizes it's a per-person view setting, so it lives in
 * localStorage rather than in the project; a track without an entry uses its kind's default.
 */
export type TrackHeightsState = {
  heightOf: (trackId: string, fallback: number) => number;
  setHeight: (trackId: string, height: number) => void;
  resetHeight: (trackId: string) => void;
};

export function useTrackHeights(): TrackHeightsState {
  const [heights, setHeights] = useState<TrackHeights>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setHeights(restoreTrackHeights(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null")));
    } catch {
      setHeights({});
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(heights));
  }, [loaded, heights]);

  const heightOf = useCallback(
    (trackId: string, fallback: number) => heights[trackId] ?? fallback,
    [heights]
  );
  const setHeight = useCallback(
    (trackId: string, height: number) =>
      setHeights((current) => ({ ...current, [trackId]: clampTrackHeight(height) })),
    []
  );
  const resetHeight = useCallback(
    (trackId: string) =>
      setHeights((current) => {
        const { [trackId]: _removed, ...rest } = current;
        return rest;
      }),
    []
  );
  return { heightOf, setHeight, resetHeight };
}
