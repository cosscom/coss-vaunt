import { describe, expect, it } from "vitest";
import { evaluateClipProperties } from "../storyboard/property-evaluation";
import type { Drift } from "../storyboard/storyboard-schema";
import { aimPan, driftView } from "./clip-drift";

const rest = evaluateClipProperties({ properties: {} }, 0);
const drift = (change: Partial<Drift> = {}): Drift => ({
  focus: { x: 0, y: 0 },
  zoom: 2,
  motion: "slide",
  direction: "left",
  intensity: 1,
  ...change,
});
const still = { panX: 0, panY: 0 };

describe("aimPan", () => {
  it("centres a corner of a device that fills the frame exactly", () => {
    const pan = aimPan({ x: -1, y: -1 }, { width: 1.6, height: 1 }, { width: 1600, height: 1000 }, 35);
    expect(pan.panX).toBeCloseTo(-0.5);
    expect(pan.panY).toBeCloseTo(-0.5);
  });

  it("reaches less far across a frame wider than the device", () => {
    const pan = aimPan({ x: 1, y: 0 }, { width: 1.6, height: 1 }, { width: 1920, height: 1080 }, 35);
    expect(pan.panX).toBeCloseTo(0.45);
  });
});

describe("driftView", () => {
  it("zooms on top of the clip's own zoom and aims at the focus", () => {
    const view = driftView({ ...rest, zoom: 1.5 }, drift({ motion: "none" }), 0.2, { panX: 0.1, panY: -0.2 });
    expect(view.zoom).toBe(3);
    expect(view.panX).toBeCloseTo(0.1);
    expect(view.panY).toBeCloseTo(-0.2);
  });

  it("slides the media left by moving the camera right, crossing the focus halfway", () => {
    const at = (progress: number) => driftView(rest, drift(), progress, still).panX;
    expect(at(0)).toBeCloseTo(-0.075);
    expect(at(0.5)).toBeCloseTo(0);
    expect(at(1)).toBeCloseTo(0.075);
  });

  it("scales its travel with intensity, and holds still at none", () => {
    expect(driftView(rest, drift({ intensity: 0.5 }), 1, still).panX).toBeCloseTo(0.0375);
    expect(driftView(rest, drift({ intensity: 0 }), 1, still).panX).toBe(0);
  });

  it("tilts around the axis across its direction", () => {
    const sideways = driftView(rest, drift({ motion: "tilt", direction: "right" }), 1, still);
    expect(sideways.rotateY).toBeCloseTo(12);
    expect(sideways.panX).toBe(0);
    const upwards = driftView(rest, drift({ motion: "slide-tilt", direction: "up" }), 1, still);
    expect(upwards.rotateX).toBeCloseTo(12);
    expect(upwards.panY).toBeCloseTo(0.075);
  });
});
