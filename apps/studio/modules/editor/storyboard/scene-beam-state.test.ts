import { describe, expect, it } from "vitest";
import { sceneBeamState } from "./scene-beam-state";

describe("sceneBeamState", () => {
  it("orbits while the scene is explored or recorded", () => {
    expect(sceneBeamState("exploring", false)).toBe("active");
    expect(sceneBeamState("recording", false)).toBe("active");
  });

  it("glows green only for a scene that has just finished", () => {
    expect(sceneBeamState("done", true)).toBe("success");
    expect(sceneBeamState("done", false)).toBe("idle");
  });

  it("stays dark while queued, after a failure, and before any generation", () => {
    expect(sceneBeamState("queued", false)).toBe("idle");
    expect(sceneBeamState("failed", true)).toBe("idle");
    expect(sceneBeamState(undefined, false)).toBe("idle");
  });
});
