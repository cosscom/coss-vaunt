import { describe, expect, it } from "vitest";
import type { CursorTravel } from "./action-schedule";
import { cursorPointAtFrame, minimumJerk, restPoint, travelPoint } from "./cursor-path";

describe("minimumJerk", () => {
  it("starts and ends at rest and is symmetric", () => {
    expect(minimumJerk(0)).toBe(0);
    expect(minimumJerk(1)).toBe(1);
    expect(minimumJerk(0.5)).toBeCloseTo(0.5);
    expect(minimumJerk(0.01)).toBeLessThan(0.0001);
    expect(minimumJerk(-1)).toBe(0);
    expect(minimumJerk(2)).toBe(1);
  });
});

describe("travelPoint", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 400, y: 0 };

  it("hits both ends exactly", () => {
    expect(travelPoint(from, to, 0)).toEqual(from);
    expect(travelPoint(from, to, 1)).toEqual(to);
  });

  it("bows off the straight line by a bounded amount", () => {
    const middle = travelPoint(from, to, 0.5);
    expect(middle.x).toBeCloseTo(200);
    expect(Math.abs(middle.y)).toBeGreaterThan(0);
    expect(Math.abs(middle.y)).toBeLessThanOrEqual(24);
  });

  it("moves slowly near the ends and fastest in the middle", () => {
    const step = (t: number) => travelPoint(from, to, t + 0.05).x - travelPoint(from, to, t).x;
    expect(step(0)).toBeLessThan(step(0.45));
    expect(step(0.95)).toBeLessThan(step(0.45));
  });
});

describe("cursorPointAtFrame", () => {
  const rest = { x: 10, y: 10 };
  const travels: CursorTravel[] = [
    { actionIndex: 0, target: "a", startFrame: 10, endFrame: 20 },
    { actionIndex: 1, target: "b", startFrame: 30, endFrame: 30 },
  ];
  const destinations = [
    { x: 110, y: 10 },
    { x: 300, y: 300 },
  ];

  it("rests before the first travel", () => {
    expect(cursorPointAtFrame({ frame: 5, travels, destinations, rest })).toEqual(rest);
  });

  it("interpolates during a travel and holds at its destination", () => {
    const during = cursorPointAtFrame({ frame: 15, travels, destinations, rest });
    expect(during.x).toBeCloseTo(60);
    expect(cursorPointAtFrame({ frame: 25, travels, destinations, rest })).toEqual(destinations[0]);
  });

  it("jumps on a zero-length travel and stays after the last one", () => {
    expect(cursorPointAtFrame({ frame: 30, travels, destinations, rest })).toEqual(destinations[1]);
    expect(cursorPointAtFrame({ frame: 99, travels, destinations, rest })).toEqual(destinations[1]);
  });

  it("starts from the previous destination when a later one is unresolved", () => {
    expect(cursorPointAtFrame({ frame: 30, travels, destinations: [destinations[0]], rest })).toEqual(
      destinations[0]
    );
  });
});

describe("restPoint", () => {
  it("sits low and right of centre", () => {
    expect(restPoint({ width: 1440, height: 900 })).toEqual({ x: 893, y: 720 });
  });
});
