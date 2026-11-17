import { describe, expect, it } from "vitest";
import { keyframeCount, keyframedProperties, keysInGroup, laneProperties } from "./keyframed-properties";

const keyframe = (at: number) => ({ id: `k${at}`, at, value: 1, ease: "linear" as const });
const clip = {
  properties: {
    opacity: { value: 1, keyframes: [keyframe(1)] },
    zoom: { value: 1, keyframes: [keyframe(0), keyframe(2)] },
    rotateX: { value: 0, keyframes: [keyframe(1)] },
    cameraX: { value: 0, keyframes: [] },
  },
};

describe("keyframedProperties", () => {
  it("lists properties with keyframes in inspector order", () => {
    expect(keyframedProperties(clip).map((property) => property.key)).toEqual(["rotateX", "zoom", "opacity"]);
    expect(keyframedProperties(clip, "device").map((property) => property.key)).toEqual(["rotateX"]);
    expect(keyframedProperties(clip, "clip").map((property) => property.key)).toEqual(["opacity"]);
  });

  it("counts keyframes", () => {
    expect([keyframeCount(clip), keyframeCount(clip, "camera"), keyframeCount(clip, "device")]).toEqual([
      4, 2, 1,
    ]);
  });
});

describe("laneProperties", () => {
  it("adds shown lanes without keyframes in inspector order", () => {
    expect(laneProperties(clip, ["fov", "cameraX"]).map((lane) => [lane.key, lane.keyframes.length])).toEqual(
      [
        ["rotateX", 1],
        ["cameraX", 0],
        ["zoom", 2],
        ["fov", 0],
        ["opacity", 1],
      ]
    );
  });

  it("lists a group's keys", () => {
    expect(keysInGroup("device")).toEqual(["rotateX", "rotateY", "rotateZ"]);
  });
});
