import { describe, expect, it } from "vitest";
import { missingEncoders, parseEncoders, parseFfmpegVersion } from "./ffmpeg-probe";

describe("parseFfmpegVersion", () => {
  it.each([
    ["ffmpeg version 9.1 Copyright (c) 2000-2026 the FFmpeg developers", "9.1"],
    ["ffmpeg version 7.1.1 Copyright (c) 2000-2025", "7.1.1"],
    ["ffmpeg version n7.1-12-gabc Copyright", "7.1"],
    ["ffmpeg version 9.1-essentials_build-www.gyan.dev Copyright", "9.1"],
    ["ffmpeg version 6.1.1-3ubuntu5 Copyright", "6.1.1"],
    ["ffmpeg version N-129157-g9ced9e345c Copyright", "N-129157-g9ced9e345c"],
  ])("reads %s", (line, version) => {
    expect(parseFfmpegVersion(`${line}\nbuilt with Apple clang\nconfiguration: --enable-gpl\n`)).toBe(
      version
    );
  });

  it("is null for anything that isn't ffmpeg", () => {
    expect(parseFfmpegVersion("")).toBeNull();
    expect(parseFfmpegVersion("ffprobe version 9.1 Copyright")).toBeNull();
  });
});

const ENCODERS = `Encoders:
 V..... = Video
 A..... = Audio
 S..... = Subtitle
 .F.... = Frame-level multithreading
 ..S... = Slice-level multithreading
 ...X.. = Codec is experimental
 ....B. = Supports draw_horiz_band
 .....D = Supports direct rendering method 1
 ------
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 V....D libx264rgb           libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 RGB (codec h264)
 V....D h264_videotoolbox    VideoToolbox H.264 Encoder (codec h264)
 V....D libwebp_anim         libwebp WebP image (codec webp)
 A....D aac                  AAC (Advanced Audio Coding)
 S..... srt                  SubRip subtitle
`;

describe("parseEncoders", () => {
  it("reads encoder names, not the legend", () => {
    const names = parseEncoders(ENCODERS);
    expect([...names]).toEqual(["libx264", "libx264rgb", "h264_videotoolbox", "libwebp_anim", "aac", "srt"]);
  });

  it("finds what's missing, without counting libwebp_anim as libwebp", () => {
    expect(missingEncoders(parseEncoders(ENCODERS))).toEqual(["libwebp"]);
    expect(
      missingEncoders(
        parseEncoders(`${ENCODERS} V....D libwebp              libwebp WebP image (codec webp)\n`)
      )
    ).toEqual([]);
    expect(missingEncoders(new Set())).toEqual(["libx264", "libwebp"]);
  });
});
