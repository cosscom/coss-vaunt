import { describe, expect, it } from "vitest";
import { evaluateClipProperties, type PropertyValues } from "../storyboard/property-evaluation";
import { layerGeometry } from "./camera-projection";
import { hitRing, ROTATION_KEYS, ringDragDegrees, rotationGizmo } from "./rotation-gizmo";

const frame = { width: 1600, height: 900 };
const device = { width: 16 / 9, height: 1 };

function setup(change: Partial<PropertyValues> = {}) {
  const values = { ...evaluateClipProperties({ properties: {} }, 0), ...change };
  return { values, geometry: layerGeometry(values, values, device, frame) };
}

describe("rotationGizmo", () => {
  it("centres on the pivot with X right, Y up and Z towards the camera", () => {
    const { values, geometry } = setup();
    const gizmo = rotationGizmo(geometry, values);
    expect(gizmo.pivot).toEqual([expect.closeTo(800), expect.closeTo(450)]);
    expect(gizmo.arrows.x[0]).toBeGreaterThan(800);
    expect(gizmo.arrows.y[1]).toBeLessThan(450);
    expect(gizmo.rings.map((ring) => ring.key)).toEqual(ROTATION_KEYS);
  });

  it("turns the rings with the device", () => {
    const flat = setup();
    const turned = setup({ rotateY: 40 });
    const zRing = (state: typeof flat) =>
      rotationGizmo(state.geometry, state.values).rings.find((ring) => ring.key === "rotateZ")?.points[0];
    expect(zRing(turned)).not.toEqual(zRing(flat));
  });
});

describe("hitRing", () => {
  it("finds a ring within 8 px and nothing far from every ring", () => {
    const { values, geometry } = setup();
    const gizmo = rotationGizmo(geometry, values);
    const zRing = gizmo.rings.find((ring) => ring.key === "rotateZ");
    const [x, y] = zRing?.points[10] ?? [0, 0];
    expect(hitRing(gizmo, [x + 5, y])).toBe("rotateZ");
    expect(hitRing(gizmo, [20, 20])).toBeNull();
  });
});

describe("ringDragDegrees", () => {
  it("turns a ring facing the camera by the angle swept, counter-clockwise positive like the sphere", () => {
    const { values, geometry } = setup();
    const quarterTurnCounterClockwise = ringDragDegrees(geometry, values, "rotateZ", [900, 450], [800, 350]);
    expect(quarterTurnCounterClockwise).toBeCloseTo(90);
  });

  it.each([
    ["rotateX", { rotateY: 25 }],
    ["rotateY", { rotateX: 15 }],
    ["rotateZ", { rotateX: -20, rotateY: 30 }],
  ] as const)("turns %s the way its ring runs, by about the angle dragged along it", (key, change) => {
    const { values, geometry } = setup(change);
    const ring = rotationGizmo(geometry, values).rings.find((candidate) => candidate.key === key);
    const from = ring?.points[30] ?? [0, 0];
    const to = ring?.points[32] ?? [0, 0];
    const degrees = ringDragDegrees(geometry, values, key, from, to);
    const expected = (2 / 96) * 360;
    expect(degrees).toBeGreaterThan(expected * 0.5);
    expect(degrees).toBeLessThan(expected * 1.6);
  });
});
