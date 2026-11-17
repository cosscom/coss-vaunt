import { describe, expect, it } from "vitest";
import { formatTimecode } from "./format-timecode";

describe("formatTimecode", () => {
  it("formats minutes, seconds and hundredths", () => {
    expect(formatTimecode(0)).toBe("00:00.00");
    expect(formatTimecode(11.024)).toBe("00:11.02");
    expect(formatTimecode(61.5)).toBe("01:01.50");
    expect(formatTimecode(59.999)).toBe("01:00.00");
  });
});
