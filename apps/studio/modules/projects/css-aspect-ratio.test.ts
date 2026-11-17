import { describe, expect, it } from "vitest";
import { cssAspectRatio } from "./css-aspect-ratio";

describe("cssAspectRatio", () => {
  it("turns a ratio into a CSS aspect ratio", () => {
    expect(cssAspectRatio("9:16")).toBe("9 / 16");
  });
});
