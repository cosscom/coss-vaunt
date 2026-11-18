import { describe, expect, it } from "vitest";
import {
  estimatedBytes,
  exportSize,
  ffmpegExportArgs,
  matchingPreset,
  presetSettings,
} from "./export-settings";

describe("export settings", () => {
  it("sizes the output from the aspect ratio and resolution, with even sides", () => {
    expect(exportSize("16:9", "1080p")).toEqual({ width: 1920, height: 1080 });
    expect(exportSize("9:16", "2160p")).toEqual({ width: 2160, height: 3840 });
    expect(exportSize("4:5", "720p")).toEqual({ width: 720, height: 900 });
  });

  it("knows a preset until a setting is changed by hand", () => {
    const social = presetSettings("social", 60);
    expect(matchingPreset(social, 60)).toBe("social");
    expect(matchingPreset({ ...social, videoBitrateMbps: 12 }, 60)).toBeNull();
    expect(matchingPreset({ ...presetSettings("lossless", 30), videoBitrateMbps: 99 }, 30)).toBe("lossless");
  });

  it("estimates size from bitrate and length", () => {
    const web = presetSettings("web", 30);
    expect(estimatedBytes(web, { width: 1920, height: 1080 }, 10)).toBeCloseTo(((8e6 + 192e3) / 8) * 10);
  });

  it("encodes H.264 at the chosen bitrate with audio, and ProRes 4444 for lossless", () => {
    const mp4 = ffmpegExportArgs({
      settings: presetSettings("web", 30),
      audioFile: "/tmp/a.wav",
      output: "/tmp/o.mp4",
    });
    expect(mp4.join(" ")).toContain("-framerate 30 -c:v png -i - -i /tmp/a.wav");
    expect(mp4.join(" ")).toContain("-c:v libx264");
    expect(mp4.join(" ")).toContain("-b:v 8M -maxrate 12M -bufsize 16M");
    expect(mp4.join(" ")).toContain("-c:a aac");
    expect(mp4.at(-1)).toBe("/tmp/o.mp4");
    const master = ffmpegExportArgs({
      settings: presetSettings("lossless", 60),
      audioFile: null,
      output: "/tmp/o.mov",
    });
    expect(master.join(" ")).toContain("-c:v prores_ks -profile:v 4");
    expect(master).not.toContain("-c:a");
  });
});
