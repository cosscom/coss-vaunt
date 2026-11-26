import { describe, expect, it } from "vitest";
import { glassAttributes } from "./appearance";

describe("glassAttributes", () => {
  it("applies glass only where the window can show it", () => {
    expect(glassAttributes({ glass: true, tint: 64 }, true)).toEqual({ glass: true, tint: "64%" });
    expect(glassAttributes({ glass: true, tint: 64 }, false).glass).toBe(false);
    expect(glassAttributes({ glass: false, tint: 64 }, true).glass).toBe(false);
  });

  it("rounds and clamps the tint", () => {
    expect(glassAttributes({ glass: true, tint: 33.4 }, true).tint).toBe("33%");
    expect(glassAttributes({ glass: true, tint: 140 }, true).tint).toBe("100%");
    expect(glassAttributes({ glass: true, tint: -5 }, true).tint).toBe("0%");
  });
});
