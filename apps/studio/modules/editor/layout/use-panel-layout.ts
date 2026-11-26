"use client";

import { useEffect, useRef, useState } from "react";
import { type PanelSize, type PanelSpec, restorePanel } from "./panel-resize";

export const PANEL_SPECS = {
  prompt: { min: 220, max: 420, defaultSize: 272, collapsible: true },
  inspector: { min: 300, max: 520, defaultSize: 336, collapsible: true },
  /** Sized to its content (`fitContent`) until someone drags it; double-clicking the splitter goes back to that. */
  timeline: { min: 160, max: 640, defaultSize: 320, collapsible: false, fitsContent: true },
  /** Hidden until opened from the title bar, the storyboard or ⌘L, so the editor starts clean. */
  agent: { min: 300, max: 520, defaultSize: 360, collapsible: true, defaultCollapsed: true },
} satisfies Record<string, PanelSpec>;

export type PanelId = keyof typeof PANEL_SPECS;
type PanelSizes = Record<PanelId, PanelSize>;

const FITTING_IDS = (Object.keys(PANEL_SPECS) as PanelId[]).filter(
  (id) => (PANEL_SPECS[id] as PanelSpec).fitsContent === true
);

/**
 * The panels still fitting their content. A layout saved before fitting existed fits too while its timeline is still
 * at the old default height, since that was never chosen by hand.
 */
function restoreFitting(record: Record<string, unknown>): PanelId[] {
  if (Array.isArray(record.fit)) return FITTING_IDS.filter((id) => (record.fit as unknown[]).includes(id));
  return FITTING_IDS.filter((id) => {
    const stored = record[id] as { size?: unknown } | undefined;
    return stored === undefined || stored.size === PANEL_SPECS[id].defaultSize;
  });
}

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
  const [fitting, setFitting] = useState<readonly PanelId[]>(FITTING_IDS);
  /** The last content size each fitting panel reported, so a reset can go back to it at once. */
  const contentSizes = useRef<Partial<Record<PanelId, number>>>({});

  useEffect(() => {
    try {
      const current = window.localStorage.getItem(STORAGE_KEY);
      const stored: unknown = JSON.parse(current ?? window.localStorage.getItem(LEGACY_KEY) ?? "null");
      const record =
        typeof stored === "object" && stored !== null ? { ...(stored as Record<string, unknown>) } : {};
      if (current === null) delete record.agent;
      setFitting(restoreFitting(record));
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
    if (loaded) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...sizes, fit: fitting }));
  }, [loaded, sizes, fitting]);

  // Content measured before the saved layout loaded applies once it has.
  useEffect(() => {
    if (!loaded) return;
    for (const id of fitting) {
      const content = contentSizes.current[id];
      if (content === undefined) continue;
      const spec = PANEL_SPECS[id];
      const size = Math.round(Math.min(spec.max, Math.max(spec.min, content)));
      setSizes((current) =>
        current[id].size === size ? current : { ...current, [id]: { ...current[id], size } }
      );
    }
  }, [loaded, fitting]);

  const settle = (id: PanelId) => setAnimating((current) => ({ ...current, [id]: false }));
  const set = (id: PanelId, size: PanelSize) => {
    settle(id);
    setFitting((current) => current.filter((fit) => fit !== id));
    setSizes((current) => ({ ...current, [id]: size }));
  };
  const fitTo = (id: PanelId, contentSize: number) => {
    const spec = PANEL_SPECS[id];
    const size = Math.round(Math.min(spec.max, Math.max(spec.min, contentSize)));
    setSizes((current) =>
      current[id].size === size ? current : { ...current, [id]: { ...current[id], size } }
    );
  };

  return {
    sizes,
    animating: (id: PanelId) => animating[id] === true,
    /** Called when a panel's push finishes. */
    settle,
    /** Resizes without easing, as a drag does. */
    set,
    /**
     * Back to the default size, or for a panel that fits its content, back to fitting it; a reset comes from a
     * visible splitter, so the panel stays open.
     */
    reset: (id: PanelId) => {
      const content = contentSizes.current[id];
      if ((PANEL_SPECS[id] as PanelSpec).fitsContent && content !== undefined) {
        settle(id);
        setFitting((current) => (current.includes(id) ? current : [...current, id]));
        fitTo(id, content);
        return;
      }
      set(id, { size: PANEL_SPECS[id].defaultSize, collapsed: false });
    },
    /** The size a panel's content needs; it's applied while the panel is still fitting its content. */
    fitContent: (id: PanelId, contentSize: number) => {
      contentSizes.current[id] = contentSize;
      if (loaded && fitting.includes(id)) fitTo(id, contentSize);
    },
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
