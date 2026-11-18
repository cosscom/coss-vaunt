import { describe, expect, it } from "vitest";
import { hasMotionDrag, parseMotionDrag, serializeMotionDrag } from "./motion-drag";

describe("motion drag", () => {
  it("round-trips a preset and where to apply it", () => {
    const data = serializeMotionDrag({ presetId: "swing", placement: "in" });
    expect(parseMotionDrag(data)).toEqual({ presetId: "swing", placement: "in" });
  });

  it("rejects unknown presets, placements and junk", () => {
    expect(parseMotionDrag('{"presetId":"nope","placement":"in"}')).toBeNull();
    expect(parseMotionDrag('{"presetId":"swing","placement":"sideways"}')).toBeNull();
    expect(parseMotionDrag("not json")).toBeNull();
  });

  it("recognises its drag type", () => {
    expect(hasMotionDrag({ types: ["application/x-studio-motion"] })).toBe(true);
    expect(hasMotionDrag({ types: ["Files"] })).toBe(false);
  });
});
