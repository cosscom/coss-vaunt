import { describe, expect, it } from "vitest";
import {
  fitPxPerSecond,
  pxToSeconds,
  rulerTicks,
  secondsToPx,
  TIMELINE_ZOOM_LEVELS,
  wheelZoomFactor,
  zoomAroundPointer,
  zoomTimeline,
} from "./timeline-scale";

describe("time and pixels", () => {
  it("maps both ways", () => {
    expect(secondsToPx(2.5, 40)).toBe(100);
    expect(pxToSeconds(100, 40)).toBe(2.5);
  });

  it("clamps to the timeline", () => {
    expect(pxToSeconds(-20, 40)).toBe(0);
    expect(pxToSeconds(1000, 40, 12)).toBe(12);
  });
});

describe("rulerTicks", () => {
  it("labels every second when seconds are wide", () => {
    const ticks = rulerTicks(2, 80);
    expect(ticks.filter((tick) => tick.major).map((tick) => tick.seconds)).toEqual([0, 1, 2]);
    expect(ticks).toHaveLength(9);
  });

  it("spreads labels out when zoomed out", () => {
    const majors = rulerTicks(30, 16)
      .filter((tick) => tick.major)
      .map((tick) => tick.seconds);
    expect(majors).toEqual([0, 5, 10, 15, 20, 25, 30]);
  });
});

describe("zoomTimeline", () => {
  it("steps through the zoom levels and stops at the ends", () => {
    expect(zoomTimeline(36, "in")).toBe(54);
    expect(zoomTimeline(36, "out")).toBe(24);
    expect(zoomTimeline(TIMELINE_ZOOM_LEVELS[0], "out")).toBe(TIMELINE_ZOOM_LEVELS[0]);
    expect(zoomTimeline(500, "in")).toBe(800);
  });
});

describe("zoomAroundPointer", () => {
  it("keeps the time under the pointer fixed", () => {
    const before = { pxPerSecond: 50, scrollLeft: 100, pointerX: 312, padding: 12 };
    const after = zoomAroundPointer({ ...before, factor: 2 });
    const timeBefore = (before.pointerX - 12) / 50;
    const timeAfter = (after.scrollLeft + (before.pointerX - before.scrollLeft) - 12) / after.pxPerSecond;
    expect(after.pxPerSecond).toBe(100);
    expect(timeAfter).toBeCloseTo(timeBefore);
  });

  it("stops at the zoom limits", () => {
    expect(
      zoomAroundPointer({ pxPerSecond: 700, scrollLeft: 0, pointerX: 12, padding: 12, factor: 4 }).pxPerSecond
    ).toBe(800);
    expect(
      zoomAroundPointer({ pxPerSecond: 12, scrollLeft: 0, pointerX: 12, padding: 12, factor: 0.1 })
        .pxPerSecond
    ).toBe(10);
  });
});

describe("wheel and fit", () => {
  it("zooms in on a negative wheel delta", () => {
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100)).toBeLessThan(1);
  });

  it("fits a duration into a width", () => {
    expect(fitPxPerSecond(10, 1000)).toBe(100);
    expect(fitPxPerSecond(0, 1000)).toBe(54);
    expect(fitPxPerSecond(10000, 1000)).toBe(10);
  });
});
