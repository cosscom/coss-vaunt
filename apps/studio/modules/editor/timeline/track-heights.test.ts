import { describe, expect, it } from "vitest";
import {
  clampTrackHeight,
  restoreTrackHeights,
  TRACK_MAX_HEIGHT_PX,
  TRACK_MIN_HEIGHT_PX,
} from "./track-heights";

describe("clampTrackHeight", () => {
  it("keeps heights between the limits, in whole pixels", () => {
    expect(clampTrackHeight(10)).toBe(TRACK_MIN_HEIGHT_PX);
    expect(clampTrackHeight(999)).toBe(TRACK_MAX_HEIGHT_PX);
    expect(clampTrackHeight(64.4)).toBe(64);
  });
});

describe("restoreTrackHeights", () => {
  it("keeps numeric entries, clamped, and drops the rest", () => {
    expect(restoreTrackHeights({ a: 80, b: "tall", c: 5000, d: Number.NaN })).toEqual({
      a: 80,
      c: TRACK_MAX_HEIGHT_PX,
    });
    expect(restoreTrackHeights(null)).toEqual({});
    expect(restoreTrackHeights([80, 90])).toEqual({});
  });
});
