import { describe, expect, it } from "vitest";
import { keyframeState } from "./keyframe-state";

describe("keyframeState", () => {
  const property = { value: 1, keyframes: [{ id: "k", at: 2, value: 1.5, ease: "linear" as const }] };

  it("tells the three diamond states apart", () => {
    expect(keyframeState(undefined, 0)).toBe("none");
    expect(keyframeState({ value: 1, keyframes: [] }, 0)).toBe("none");
    expect(keyframeState(property, 2)).toBe("at-playhead");
    expect(keyframeState(property, 1)).toBe("elsewhere");
    expect(keyframeState(property, 2.015)).toBe("elsewhere");
    expect(keyframeState(property, 2.015, 0.5 / 30)).toBe("at-playhead");
  });
});
