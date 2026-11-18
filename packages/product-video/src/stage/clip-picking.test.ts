import { describe, expect, it } from "vitest";
import { evaluateClipProperties, type PropertyValues } from "../storyboard/property-evaluation";
import { createRecordingClip, createTextClip } from "../storyboard/storyboard-factories";
import type { ActiveClip } from "../storyboard/track-resolution";
import { layerGeometry } from "./camera-projection";
import { deviceWorldSize } from "./camera-rig";
import { deviceOutline, videoClipAt } from "./clip-picking";

const frame = { width: 1600, height: 900 };
const geometryFor = (change: Partial<PropertyValues> = {}) => {
  const values = { ...evaluateClipProperties({ properties: {} }, 0), ...change };
  return layerGeometry(values, values, deviceWorldSize({ width: 1920, height: 1080 }), frame);
};
const active = (id: string, kind: "recording" | "text" = "recording"): ActiveClip => ({
  clip: {
    ...(kind === "text" ? createTextClip({ text: "Hi" }) : createRecordingClip({ name: id, route: "/" })),
    id,
  },
  trackIndex: 0,
  localTime: 0,
  presence: 1,
  transition: null,
});

describe("videoClipAt", () => {
  const layers = { below: geometryFor(), above: geometryFor({ scale: 0.5, x: 0.25 }) };
  const layerAt = (id: string) => layers[id as keyof typeof layers] ?? null;
  const clips = [active("below"), active("above"), active("title", "text")];

  it("picks the topmost device under the point and skips text", () => {
    expect(videoClipAt(clips, layerAt, 1200, 450)).toBe("above");
    expect(videoClipAt(clips, layerAt, 200, 450)).toBe("below");
  });

  it("misses outside every device, and clips the stage didn't draw", () => {
    const small = (id: string) => (id === "above" ? layers.above : null);
    expect(videoClipAt(clips, small, 200, 450)).toBeNull();
  });
});

describe("deviceOutline", () => {
  it("traces the device's corners in the frame", () => {
    const outline = deviceOutline(geometryFor({ scale: 0.5 }));
    expect(outline.map(([x, y]) => [Math.round(x), Math.round(y)])).toEqual([
      [400, 225],
      [1200, 225],
      [1200, 675],
      [400, 675],
    ]);
  });
});
