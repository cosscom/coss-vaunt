import { findMotionPreset } from "@calcom/product-video/catalogues/motion-presets/motion-presets";
import { describe, expect, it } from "vitest";
import { motionPreviewFrames, previewStyle } from "./motion-preview";

const flip = findMotionPreset("flip-up");

describe("previewStyle", () => {
  it("draws the rest pose untransformed and fully visible", () => {
    expect(previewStyle({})).toEqual({
      transform: "translate(0%, 0%) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1)",
      opacity: 1,
    });
  });

  it("turns the device against a camera move", () => {
    expect(previewStyle({ cameraY: -40 }).transform).toContain("rotateY(40deg)");
  });
});

describe("motionPreviewFrames", () => {
  it("plays in, holds, plays out and pauses", () => {
    if (!flip) throw new Error("missing preset");
    const { frames, durationMs } = motionPreviewFrames(flip, "both");
    expect(durationMs).toBe(3600);
    expect(frames.map((frame) => Number(frame.offset.toFixed(3)))).toEqual([
      0, 0.083, 0.361, 0.611, 0.889, 1,
    ]);
    expect(frames[0]?.opacity).toBe(0);
    expect(frames[2]?.opacity).toBe(1);
    expect(frames[1]?.easing).toBe("cubic-bezier(0.22, 1, 0.36, 1)");
  });

  it("starts at rest when only the exit is applied", () => {
    if (!flip) throw new Error("missing preset");
    const { frames } = motionPreviewFrames(flip, "out");
    expect(frames[0]?.opacity).toBe(1);
    expect(frames.at(-1)?.opacity).toBe(0);
  });
});
