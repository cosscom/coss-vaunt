import { describe, expect, it } from "vitest";
import { clipSchema, DEFAULT_IMAGE_CLIP_SECONDS, MAX_CLIP_SECONDS } from "./storyboard-schema";

const image = (duration = DEFAULT_IMAGE_CLIP_SECONDS) => ({
  id: "c1",
  name: "screenshot.png",
  start: 0,
  duration,
  transitionIn: "cut",
  properties: {},
  source: { kind: "image", file: "imports/abc-screenshot.png", width: 2880, height: 1800 },
});

describe("image clips", () => {
  it("accepts an image clip up to the clip cap", () => {
    expect(clipSchema.safeParse(image()).success).toBe(true);
    expect(clipSchema.safeParse(image(MAX_CLIP_SECONDS)).success).toBe(true);
  });

  it("rejects an image clip over the clip cap", () => {
    expect(clipSchema.safeParse(image(MAX_CLIP_SECONDS + 1)).error?.issues[0]?.path).toEqual(["duration"]);
  });

  it("requires a file and a positive integer size", () => {
    const { source } = image();
    expect(clipSchema.safeParse({ ...image(), source: { ...source, file: "" } }).success).toBe(false);
    expect(clipSchema.safeParse({ ...image(), source: { ...source, width: 0 } }).success).toBe(false);
    expect(clipSchema.safeParse({ ...image(), source: { ...source, height: 1.5 } }).success).toBe(false);
  });
});
