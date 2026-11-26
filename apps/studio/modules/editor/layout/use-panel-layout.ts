"use client";

import { useEffect, useState } from "react";
import { type PanelSize, type PanelSpec, restorePanel } from "./panel-resize";

export const PANEL_SPECS = {
  prompt: { min: 220, max: 420, defaultSize: 272, collapsible: true },
  inspector: { min: 300, max: 520, defaultSize: 336, collapsible: true },
  timeline: { min: 160, max: 640, defaultSize: 320, collapsible: false },
  /** Hidden until opened from the title bar, the storyboard or ⌘L, so the editor starts clean. */
  agent: { min: 300, max: 520, defaultSize: 360, collapsible: true, defaultCollapsed: true },
} satisfies Record<string, PanelSpec>;

export type PanelId = keyof typeof PANEL_SPECS;
type PanelSizes = Record<PanelId, PanelSize>;

const STORAGE_KEY = "studio.editor-layout.v2";
/** v1 had the agent open by default; its other panels carry over, the agent starts hidden. */
const LEGACY_KEY = "studio.editor-layout.v1";
const PANEL_IDS = Object.keys(PANEL_SPECS) as PanelId[];

function defaults(): PanelSizes {
  return Object.fromEntries(PANEL_IDS.map((id) => [id, restorePanel(PANEL_SPECS[id], null)])) as PanelSizes;
}

/**
 * Panel sizes are per person, so they live in localStorage rather than in the project. `animating` marks the panels
 * a toggle is opening or closing, so their push eases; a drag or reset moves them without easing.
 */
export function usePanelLayout() {
  const [sizes, setSizes] = useState<PanelSizes>(defaults);
  const [loaded, setLoaded] = useState(false);
  const [animating, setAnimating] = useState<Partial<Record<PanelId, boolean>>>({});

  useEffect(() => {
    try {
      const current = window.localStorage.getItem(STORAGE_KEY);
      const stored: unknown = JSON.parse(current ?? window.localStorage.getItem(LEGACY_KEY) ?? "null");
      const record =
        typeof stored === "object" && stored !== null ? { ...(stored as Record<string, unknown>) } : {};
      if (current === null) delete record.agent;
      setSizes(
        Object.fromEntries(
          PANEL_IDS.map((id) => [id, restorePanel(PANEL_SPECS[id], record[id])])
        ) as PanelSizes
      );
    } catch {
      setSizes(defaults());
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
  }, [loaded, sizes]);

  const settle = (id: PanelId) => setAnimating((current) => ({ ...current, [id]: false }));
  const set = (id: PanelId, size: PanelSize) => {
    settle(id);
    setSizes((current) => ({ ...current, [id]: size }));
  };

  return {
    sizes,
    animating: (id: PanelId) => animating[id] === true,
    /** Called when a panel's push finishes. */
    settle,
    /** Resizes without easing, as a drag does. */
    set,
    /** Back to the default size; a reset comes from a visible splitter, so the panel stays open. */
    reset: (id: PanelId) => set(id, { size: PANEL_SPECS[id].defaultSize, collapsed: false }),
    /** Opens or closes a panel, easing the push unless the user prefers reduced motion. */
    toggle: (id: PanelId) => {
      setAnimating((current) => ({
        ...current,
        [id]: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      }));
      setSizes((current) => ({ ...current, [id]: { ...current[id], collapsed: !current[id].collapsed } }));
    },
  };
}
