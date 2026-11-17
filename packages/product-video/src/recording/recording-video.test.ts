import { describe, expect, it } from "vitest";
import { recordingVideoArgs, VIDEO_KEYFRAME_INTERVAL, videoSize } from "./recording-video";

describe("recordingVideoArgs", () => {
  const args = recordingVideoArgs({
    framesPattern: "frames/%06d.png",
    output: "out.mp4",
    fps: 60,
    width: 1440,
    height: 900,
  });
  const after = (flag: string) => args[args.indexOf(flag) + 1];

  it("keeps every frame at the recording's rate", () => {
    expect(after("-framerate")).toBe("60");
    expect(after("-fps_mode")).toBe("passthrough");
    expect(args).not.toContain("-r");
  });

  it("encodes seekable, streamable 4:2:0 H.264 at the viewport size", () => {
    expect(after("-c:v")).toBe("libx264");
    expect(after("-vf")).toContain("scale=1440:900");
    expect(after("-vf")).toContain("format=yuv420p");
    expect(after("-g")).toBe(String(VIDEO_KEYFRAME_INTERVAL));
    expect(after("-sc_threshold")).toBe("0");
    expect(after("-movflags")).toBe("+faststart");
    expect(args.at(-1)).toBe("out.mp4");
  });
});

describe("videoSize", () => {
  it("rounds down to even dimensions", () => {
    expect(videoSize({ width: 1441, height: 901 })).toEqual({ width: 1440, height: 900 });
  });
});
