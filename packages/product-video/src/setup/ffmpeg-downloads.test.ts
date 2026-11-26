import { describe, expect, it } from "vitest";
import { downloadBytes, ffmpegDownloadFor } from "./ffmpeg-downloads";

describe("ffmpegDownloadFor", () => {
  it.each([
    ["darwin", "arm64"],
    ["darwin", "x64"],
    ["linux", "x64"],
    ["linux", "arm64"],
    ["win32", "x64"],
  ] as const)("has a pinned HTTPS download for %s-%s", (platform, arch) => {
    const download = ffmpegDownloadFor(platform, arch);
    expect(download).not.toBeNull();
    for (const archive of download?.archives ?? []) {
      expect(archive.url).toMatch(/^https:\/\//);
      expect(archive.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(archive.bytes).toBeGreaterThan(1_000_000);
    }
  });

  it("has nothing for platforms without a trusted build", () => {
    expect(ffmpegDownloadFor("win32", "arm64")).toBeNull();
    expect(ffmpegDownloadFor("freebsd", "x64")).toBeNull();
  });

  it("adds up the archives' sizes", () => {
    const download = ffmpegDownloadFor("darwin", "arm64");
    expect(download && downloadBytes(download)).toBe(28_623_086 + 28_541_295);
  });
});
