import { describe, expect, it } from "vitest";
import { dropTime } from "./drop-time";

describe("dropTime", () => {
  it("reads time past the lane padding, rounded to the grid and never negative", () => {
    expect(dropTime(100 + 12 + 300, 100, 54)).toBe(5.6);
    expect(dropTime(50, 100, 54)).toBe(0);
  });
});
