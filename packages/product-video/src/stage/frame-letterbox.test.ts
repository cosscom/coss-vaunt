import { describe, expect, it } from "vitest";
import { aspectRatioSize, letterbox } from "./frame-letterbox";

describe("letterbox", () => {
  it("fits a portrait frame into a landscape area, centred", () => {
    expect(letterbox({ width: 1000, height: 600 }, aspectRatioSize("9:16"), 20)).toEqual({
      width: 315,
      height: 560,
      x: 343,
      y: 20,
    });
  });

  it("collapses to nothing when the area is smaller than the padding", () => {
    expect(letterbox({ width: 10, height: 10 }, aspectRatioSize("16:9"), 20)).toMatchObject({
      width: 0,
      height: 0,
    });
  });
});
