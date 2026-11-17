import { describe, expect, it } from "vitest";
import {
  importYoutubeVideo,
  parseDownloadPercent,
  parseYoutubeVideoId,
  youtubeImportFile,
} from "./youtube-import";

describe("parseYoutubeVideoId", () => {
  it.each([
    ["aqz-KE-bpKQ", "aqz-KE-bpKQ"],
    ["  aqz-KE-bpKQ ", "aqz-KE-bpKQ"],
    ["https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=10s", "aqz-KE-bpKQ"],
    ["youtube.com/watch?v=aqz-KE-bpKQ", "aqz-KE-bpKQ"],
    ["https://youtu.be/aqz-KE-bpKQ?si=abc", "aqz-KE-bpKQ"],
    ["https://m.youtube.com/shorts/aqz-KE-bpKQ", "aqz-KE-bpKQ"],
    ["https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ", "aqz-KE-bpKQ"],
  ])("reads %s", (input, id) => {
    expect(parseYoutubeVideoId(input)).toBe(id);
  });

  it.each([
    "",
    "short",
    "aqz-KE-bpKQ; rm -rf /",
    "https://example.com/watch?v=aqz-KE-bpKQ",
    "https://youtu.be/../etc",
  ])("rejects %s", (input) => {
    expect(parseYoutubeVideoId(input)).toBeNull();
  });
});

describe("parseDownloadPercent", () => {
  it("reads yt-dlp progress lines only", () => {
    expect(parseDownloadPercent("[download]  42.1% of ~ 120.00MiB at 3.00MiB/s ETA 00:20")).toBe(42.1);
    expect(parseDownloadPercent("[download] Destination: x.mp4")).toBeNull();
    expect(parseDownloadPercent("[Merger] Merging formats")).toBeNull();
  });
});

describe("importYoutubeVideo", () => {
  it("refuses an invalid id before touching the disk or a binary", async () => {
    await expect(
      importYoutubeVideo({ projectDir: "/nonexistent", videoId: "--exec=sh" })
    ).rejects.toMatchObject({
      code: "invalid-id",
    });
  });

  it("stores imports under the project's imports folder", () => {
    expect(youtubeImportFile("aqz-KE-bpKQ")).toBe("imports/youtube-aqz-KE-bpKQ.mp4");
  });
});
