import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checksumMatches, ffmpegInstallHint } from "./ffmpeg-install";

describe("checksumMatches", () => {
  const digest = createHash("sha256").update("ffmpeg").digest("hex");

  it("matches the same digest regardless of case and whitespace", () => {
    expect(checksumMatches(digest, digest)).toBe(true);
    expect(checksumMatches(digest, ` ${digest.toUpperCase()}\n`)).toBe(true);
  });

  it("refuses a different digest", () => {
    expect(checksumMatches(digest, createHash("sha256").update("ffmpeg!").digest("hex"))).toBe(false);
    expect(checksumMatches(digest, "")).toBe(false);
  });
});

describe("ffmpegInstallHint", () => {
  it("suggests each platform's package manager", () => {
    expect(ffmpegInstallHint("darwin")).toBe("brew install ffmpeg");
    expect(ffmpegInstallHint("win32")).toContain("winget");
    expect(ffmpegInstallHint("linux")).toContain("apt");
  });
});
