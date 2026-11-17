import { describe, expect, it } from "vitest";
import { previewLoopTime } from "./preview-loop";

describe("previewLoopTime", () => {
  const totals = { enterMs: 500, exitMs: 300 };

  it("plays enter, hold and exit as one clip", () => {
    expect(previewLoopTime(0, totals)).toEqual({ localTime: 0, clipDuration: 1.7 });
    expect(previewLoopTime(1699, totals)?.localTime).toBeCloseTo(1.699);
  });

  it("is empty during the gap, then starts over", () => {
    expect(previewLoopTime(1800, totals)).toBeNull();
    expect(previewLoopTime(2050, totals)).toEqual({ localTime: 0, clipDuration: 1.7 });
  });
});
