import { describe, expect, it } from "vitest";
import type { Clip } from "../storyboard/storyboard-schema";
import { captureDpr, coverScale, OUTPUT_SIZES, peakMagnification } from "./capture-dpr";

const viewport = { width: 1440, height: 900 };
const still = { properties: {} } satisfies Pick<Clip, "properties">;
const zoomTo = (value: number): Pick<Clip, "properties"> => ({
  properties: {
    zoom: {
      value: 1,
      keyframes: [
        { id: "a", at: 0, value: 1, ease: "linear" },
        { id: "b", at: 2, value, ease: "ease-out" },
      ],
    },
  },
});

describe("coverScale", () => {
  it("covers a portrait frame by height and a landscape frame by width", () => {
    expect(coverScale(viewport, OUTPUT_SIZES["9:16"])).toBeCloseTo(1920 / 900);
    expect(coverScale(viewport, OUTPUT_SIZES["16:9"])).toBeCloseTo(1920 / 1440);
    expect(coverScale(viewport, OUTPUT_SIZES["1:1"])).toBe(1.2);
  });
});

describe("peakMagnification", () => {
  it("multiplies the highest zoom by the highest clip scale", () => {
    expect(peakMagnification(still)).toBe(1);
    expect(
      peakMagnification({ properties: { ...zoomTo(1.5).properties, scale: { value: 1.2, keyframes: [] } } })
    ).toBeCloseTo(1.8);
  });
});

describe("captureDpr", () => {
  it("rounds the needed scale up to a whole DPR", () => {
    expect(captureDpr({ aspectRatio: "16:9", viewport, clip: still })).toMatchObject({
      dpr: 2,
      exceedsBudget: false,
    });
    expect(captureDpr({ aspectRatio: "9:16", viewport, clip: still })).toMatchObject({
      dpr: 3,
      exceedsBudget: false,
    });
    expect(captureDpr({ aspectRatio: "1:1", viewport, clip: zoomTo(2.5) }).dpr).toBe(3);
  });

  it("keeps an exact fit at that DPR", () => {
    expect(captureDpr({ aspectRatio: "1:1", viewport: { width: 1080, height: 1080 }, clip: still }).dpr).toBe(
      1
    );
  });

  it("clamps between 1 and 4 and flags a pose beyond the budget", () => {
    expect(captureDpr({ aspectRatio: "1:1", viewport: { width: 4000, height: 4000 }, clip: still }).dpr).toBe(
      1
    );
    const zoomed = captureDpr({ aspectRatio: "9:16", viewport, clip: zoomTo(3) });
    expect(zoomed.dpr).toBe(4);
    expect(zoomed.exceedsBudget).toBe(true);
  });
});
