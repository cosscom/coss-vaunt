import { describe, expect, it } from "vitest";
import { formatFrameTimecode, formatTimecode } from "./format-timecode";

describe("formatTimecode", () => {
  it("formats minutes, seconds and hundredths", () => {
    expect(formatTimecode(0)).toBe("00:00.00");
    expect(formatTimecode(11.024)).toBe("00:11.02");
    expect(formatTimecode(61.5)).toBe("01:01.50");
    expect(formatTimecode(59.999)).toBe("01:00.00");
  });
});

describe("formatFrameTimecode", () => {
  it("formats minutes, seconds and frames at the project's rate", () => {
    expect(formatFrameTimecode(0, 60)).toBe("00:00:00");
    expect(formatFrameTimecode(9.4, 30)).toBe("00:09:12");
    expect(formatFrameTimecode(64, 60)).toBe("01:04:00");
    expect(formatFrameTimecode(1 - 1 / 120, 60)).toBe("00:00:59");
  });
});
