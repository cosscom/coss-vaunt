import { describe, expect, it } from "vitest";
import { dragPanelSize, releasePanel, resizePanel, restorePanel, rubberBand } from "./panel-resize";

const spec = { min: 200, max: 400, defaultSize: 280, collapsible: true };

describe("resizePanel", () => {
  it("clamps to min and max", () => {
    expect(resizePanel(spec, 280, 500)).toEqual({ size: 400, collapsed: false });
    expect(resizePanel(spec, 280, -150)).toEqual({ size: 200, collapsed: false });
  });

  it("collapses when dragged far below the minimum, unless it can't collapse", () => {
    expect(resizePanel(spec, 280, -200)).toEqual({ size: 200, collapsed: true });
    expect(resizePanel({ ...spec, collapsible: false }, 280, -200)).toEqual({ size: 200, collapsed: false });
  });
});

describe("restorePanel", () => {
  it("falls back to the default and clamps stored sizes", () => {
    expect(restorePanel(spec, null)).toEqual({ size: 280, collapsed: false });
    expect(restorePanel(spec, { size: 9000, collapsed: true })).toEqual({ size: 400, collapsed: true });
    expect(restorePanel(spec, { size: "wide" })).toEqual({ size: 280, collapsed: false });
  });

  it("starts a panel hidden when its spec says so, until someone opens it", () => {
    const hidden = { ...spec, defaultCollapsed: true };
    expect(restorePanel(hidden, null)).toEqual({ size: 280, collapsed: true });
    expect(restorePanel(hidden, { size: 300, collapsed: false })).toEqual({ size: 300, collapsed: false });
    expect(restorePanel({ ...hidden, collapsible: false }, null)).toEqual({ size: 280, collapsed: false });
  });
});

describe("rubber band", () => {
  it("follows the pointer past a limit with growing resistance", () => {
    expect(rubberBand(0)).toBe(0);
    expect(rubberBand(120)).toBeCloseTo(33);
    expect(rubberBand(240) - rubberBand(120)).toBeLessThan(rubberBand(120));
  });

  it("shows overshoot while dragging and settles at the limit on release", () => {
    expect(dragPanelSize(spec, 280, 60)).toBe(340);
    expect(dragPanelSize(spec, 280, 240)).toBeCloseTo(400 + rubberBand(120));
    expect(dragPanelSize(spec, 280, -150)).toBeCloseTo(200 - rubberBand(70));
    expect(releasePanel(spec, 280, 240)).toEqual({ size: 400, collapsed: false });
    expect(releasePanel(spec, 280, -200)).toEqual({ size: 200, collapsed: true });
  });
});
