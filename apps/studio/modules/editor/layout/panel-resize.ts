export type PanelSpec = { min: number; max: number; defaultSize: number; collapsible: boolean };
export type PanelSize = { size: number; collapsed: boolean };

/** Dragging well past the minimum collapses a collapsible panel; dragging back out restores it. */
const COLLAPSE_FRACTION = 0.5;

export function resizePanel(spec: PanelSpec, startSize: number, delta: number): PanelSize {
  const raw = startSize + delta;
  if (spec.collapsible && raw < spec.min * COLLAPSE_FRACTION) return { size: spec.min, collapsed: true };
  return { size: Math.min(spec.max, Math.max(spec.min, raw)), collapsed: false };
}

/** Sizes read from storage are clamped so a changed spec or a hand-edited value can't break the layout. */
export function restorePanel(spec: PanelSpec, stored: unknown): PanelSize {
  if (typeof stored !== "object" || stored === null) return { size: spec.defaultSize, collapsed: false };
  const { size, collapsed } = stored as { size?: unknown; collapsed?: unknown };
  return {
    size:
      typeof size === "number" && Number.isFinite(size)
        ? Math.min(spec.max, Math.max(spec.min, size))
        : spec.defaultSize,
    collapsed: spec.collapsible && collapsed === true,
  };
}

/** Travel past a limit, damped: it keeps following the pointer but slows the further it goes. */
export function rubberBand(overshoot: number): number {
  return (overshoot * 0.55) / (1 + overshoot / 120);
}

/** The size shown mid-drag: free within the limits, rubber-banded past them. */
export function dragPanelSize(spec: PanelSpec, startSize: number, delta: number): number {
  const raw = startSize + delta;
  if (raw > spec.max) return spec.max + rubberBand(raw - spec.max);
  if (raw < spec.min) return spec.min - rubberBand(spec.min - raw);
  return raw;
}

/** Where a drag settles on release: clamped, or collapsed when let go far enough below the minimum. */
export function releasePanel(spec: PanelSpec, startSize: number, delta: number): PanelSize {
  return resizePanel(spec, startSize, delta);
}
