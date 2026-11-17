import { describe, expect, it } from "vitest";
import { visibleSpan } from "./visible-span";

describe("visibleSpan", () => {
  it("clips an element to the viewport in its own pixels", () => {
    expect(visibleSpan(100, 400, 0, 300)).toEqual([0, 200]);
    expect(visibleSpan(-150.5, 400, 0, 1000)).toEqual([150, 400]);
    expect(visibleSpan(-50, 1000, 176, 800)).toEqual([226, 850]);
  });

  it("is null when the element is off screen", () => {
    expect(visibleSpan(900, 100, 0, 800)).toBeNull();
    expect(visibleSpan(-300, 100, 0, 800)).toBeNull();
  });
});
