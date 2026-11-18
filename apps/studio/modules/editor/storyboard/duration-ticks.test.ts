import { describe, expect, it } from "vitest";
import { durationTicks, nearestTick } from "./duration-ticks";

describe("durationTicks", () => {
  it("draws a bar per half second for a recording, with whole seconds major", () => {
    const ticks = durationTicks(0.5, 8);
    expect(ticks).toHaveLength(16);
    expect(ticks[0]).toEqual({ value: 0.5, major: false });
    expect(ticks[1]).toEqual({ value: 1, major: true });
    expect(ticks.at(-1)).toEqual({ value: 8, major: true });
  });

  it("thins to a bar per second for long clips, with every fifth major", () => {
    const ticks = durationTicks(0.5, 60);
    expect(ticks).toHaveLength(60);
    expect(ticks[0]).toEqual({ value: 1, major: false });
    expect(ticks[4]).toEqual({ value: 5, major: true });
  });
});

describe("nearestTick", () => {
  it("finds the closest bar", () => {
    const ticks = durationTicks(0.5, 60);
    expect(nearestTick(ticks, 4.4)).toBe(3);
    expect(nearestTick(ticks, 0.5)).toBe(0);
  });
});
