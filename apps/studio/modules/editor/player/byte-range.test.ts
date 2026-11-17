import { describe, expect, it } from "vitest";
import { parseByteRange } from "./byte-range";

describe("parseByteRange", () => {
  it("serves the whole file without a usable header", () => {
    expect(parseByteRange(null, 100)).toBeNull();
    expect(parseByteRange("bytes=0-10,20-30", 100)).toBeNull();
    expect(parseByteRange("items=0-10", 100)).toBeNull();
  });

  it("reads open, closed and suffix ranges, clamped to the file", () => {
    expect(parseByteRange("bytes=0-", 100)).toEqual({ start: 0, end: 99 });
    expect(parseByteRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(parseByteRange("bytes=90-500", 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange("bytes=-500", 100)).toEqual({ start: 0, end: 99 });
  });

  it("refuses ranges outside the file", () => {
    expect(parseByteRange("bytes=100-", 100)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=20-10", 100)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=-0", 100)).toBe("unsatisfiable");
  });
});
