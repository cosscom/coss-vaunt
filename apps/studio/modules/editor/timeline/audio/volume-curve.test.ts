import type { AudioClip } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { describe, expect, it } from "vitest";
import { volumeCurvePoints, volumeLineY } from "./volume-curve";

const clip: Pick<AudioClip, "volume" | "duration" | "fadeIn" | "fadeOut"> = {
  volume: { value: 0.5, keyframes: [] },
  duration: 2,
  fadeIn: 1,
  fadeOut: 0,
};

describe("volumeLineY", () => {
  it("puts full volume near the top and silence near the bottom", () => {
    expect(volumeLineY(1, 46)).toBe(3);
    expect(volumeLineY(0, 46)).toBe(43);
    expect(volumeLineY(0.5, 46)).toBe(23);
  });
});

describe("volumeCurvePoints", () => {
  it("ramps through the fade in and holds the volume after it, relative to the visible start", () => {
    const points = volumeCurvePoints(clip, 0, 6, 10, 46).split(" ");
    expect(points[0]).toBe("0,43.0");
    expect(points.at(-1)).toBe("6,31.0");
    expect(volumeCurvePoints(clip, 12, 13, 10, 46).split(" ")[0]).toBe("0,23.0");
  });
});
