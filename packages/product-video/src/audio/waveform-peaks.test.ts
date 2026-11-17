import { describe, expect, it } from "vitest";
import { computePeaks, parsePeaksFile, peaksFilePath, waveformColumns } from "./waveform-peaks";

describe("computePeaks", () => {
  it("takes the min and max of each bucket", () => {
    const samples = new Float32Array([0.1, -0.5, 0.3, 0.9, -0.2, 0, 0.4]);
    expect(computePeaks(samples, 8, 2)).toEqual({ bucketsPerSecond: 2, peaks: [-0.5, 0.9, -0.2, 0.4] });
  });

  it("includes a short last bucket and clamps to −1..1", () => {
    const { peaks } = computePeaks(new Float32Array([0, 0, 1.5]), 2, 1);
    expect(peaks).toEqual([0, 0, 0, 1]);
  });

  it("makes 100 buckets a second at 8 kHz", () => {
    expect(computePeaks(new Float32Array(8000 * 2), 8000).peaks).toHaveLength(400);
  });
});

describe("parsePeaksFile", () => {
  it("accepts min/max pairs and refuses anything else", () => {
    expect(parsePeaksFile({ bucketsPerSecond: 100, peaks: [-0.1, 0.2] })?.peaks).toEqual([-0.1, 0.2]);
    expect(parsePeaksFile({ bucketsPerSecond: 100, peaks: [-0.1] })).toBeNull();
    expect(parsePeaksFile({ bucketsPerSecond: 100, peaks: [2, 0] })).toBeNull();
    expect(parsePeaksFile("nope")).toBeNull();
  });
});

describe("waveformColumns", () => {
  const peaks = { bucketsPerSecond: 4, peaks: [-0.1, 0.1, -0.4, 0.2, -0.2, 0.8, 0, 0.3] };

  it("merges buckets when a column spans several", () => {
    expect(Array.from(waveformColumns(peaks, 0, 0.5, 2))).toEqual([
      expect.closeTo(-0.4),
      expect.closeTo(0.2),
      expect.closeTo(-0.2),
      expect.closeTo(0.8),
    ]);
  });

  it("repeats a bucket when columns are narrower than it, and is silent past the end", () => {
    const columns = Array.from(waveformColumns(peaks, 0.75, 0.125, 4));
    expect(columns.slice(0, 4)).toEqual([0, expect.closeTo(0.3), 0, expect.closeTo(0.3)]);
    expect(Array.from(waveformColumns(peaks, 5, 0.25, 1))).toEqual([0, 0]);
  });
});

describe("peaksFilePath", () => {
  it("sits next to the audio file", () => {
    expect(peaksFilePath("imports/a.mp3")).toBe("imports/a.mp3.peaks.json");
  });
});
