"use client";

import { useEffect, useState } from "react";
import { type PanelSize, type PanelSpec, restorePanel } from "./panel-resize";

export const PANEL_SPECS = {
  prompt: { min: 220, max: 420, defaultSize: 272, collapsible: true },
  inspector: { min: 300, max: 520, defaultSize: 336, collapsible: true },
  timeline: { min: 160, max: 640, defaultSize: 320, collapsible: false },
} satisfies Record<string, PanelSpec>;

export type PanelId = keyof typeof PANEL_SPECS;
type PanelSizes = Record<PanelId, PanelSize>;

const STORAGE_KEY = "studio.editor-layout.v1";
const PANEL_IDS = Object.keys(PANEL_SPECS) as PanelId[];

function defaults(): PanelSizes {
  return Object.fromEntries(PANEL_IDS.map((id) => [id, restorePanel(PANEL_SPECS[id], null)])) as PanelSizes;
}

/** Panel sizes are per person, so they live in localStorage rather than in the project. */
export function usePanelLayout() {
  const [sizes, setSizes] = useState<PanelSizes>(defaults);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
      const record = typeof stored === "object" && stored !== null ? (stored as Record<string, unknown>) : {};
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

  const set = (id: PanelId, size: PanelSize) => setSizes((current) => ({ ...current, [id]: size }));

  return {
    sizes,
    set,
    reset: (id: PanelId) => set(id, restorePanel(PANEL_SPECS[id], null)),
    toggle: (id: PanelId) => set(id, { ...sizes[id], collapsed: !sizes[id].collapsed }),
  };
}
