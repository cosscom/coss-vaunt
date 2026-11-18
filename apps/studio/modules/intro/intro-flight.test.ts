import { describe, expect, it } from "vitest";
import { centredRect, flightTransform, withAspect } from "./intro-flight";

describe("flightTransform", () => {
  it("moves the top-left corner onto the target and scales by height", () => {
    expect(
      flightTransform(
        { left: 300, top: 400, width: 720, height: 100 },
        { left: 24, top: 40, width: 144, height: 20 }
      )
    ).toBe("translate(-276px, -360px) scale(0.2)");
  });
});

describe("withAspect", () => {
  it("keeps the height and centre", () => {
    expect(withAspect({ left: 100, top: 50, width: 400, height: 50 }, 7)).toEqual({
      left: 125,
      top: 50,
      width: 350,
      height: 50,
    });
  });
});

describe("centredRect", () => {
  it("centres a box of the logo's shape", () => {
    expect(centredRect(4, { width: 1000, height: 800 }, 0.5)).toEqual({
      left: 250,
      top: 337.5,
      width: 500,
      height: 125,
    });
  });
});
