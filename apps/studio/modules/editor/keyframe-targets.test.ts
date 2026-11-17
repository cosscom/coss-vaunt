import { describe, expect, it } from "vitest";
import { groupTargetKeys, keyframeTargetKeys } from "./keyframe-targets";

describe("keyframe targets", () => {
  it("keys exactly the selected lanes, never a same-letter property from another group", () => {
    expect(keyframeTargetKeys(["rotateX", "rotateY", "rotateZ"], "cameraY")).toEqual([
      "rotateX",
      "rotateY",
      "rotateZ",
    ]);
    expect(keyframeTargetKeys([], "rotateY")).toEqual(["rotateY"]);
    expect(keyframeTargetKeys([], null)).toEqual([]);
  });

  it("keys a whole group without crossing the device and camera split", () => {
    expect(groupTargetKeys("rotateY")).toEqual(["rotateX", "rotateY", "rotateZ"]);
    const camera = groupTargetKeys("cameraY");
    expect(camera).toContain("cameraY");
    expect(camera.some((key) => key.startsWith("rotate"))).toBe(false);
    expect(groupTargetKeys(null)).toEqual(camera);
  });
});
