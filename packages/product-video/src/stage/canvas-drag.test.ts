import { describe, expect, it } from "vitest";
import type { PropertyValues } from "../storyboard/property-evaluation";
import { PROPERTY_KEYS, PROPERTY_SPECS } from "../storyboard/property-specs";
import { dragProperties, dragTarget, resetProperties, wheelZoom } from "./canvas-drag";

const start = {
  ...Object.fromEntries(PROPERTY_KEYS.map((key) => [key, PROPERTY_SPECS[key].defaultValue])),
} as PropertyValues;
const frame = { width: 800, height: 450 };

describe("dragProperties", () => {
  it("grabs the device in camera mode: dragging right and down pans left and up", () => {
    expect(dragProperties({ mode: "camera", start, dx: 200, dy: 45, frame })).toEqual({
      panX: -0.25,
      panY: -0.1,
    });
  });

  it("pans less per pixel when zoomed in", () => {
    const zoomed = { ...start, zoom: 2 };
    expect(dragProperties({ mode: "camera", start: zoomed, dx: 160, dy: 0, frame }).panX).toBe(-0.1);
  });

  it("orbits the camera so the scene turns towards the drag", () => {
    expect(dragProperties({ mode: "orbit", start, dx: 400, dy: -45, frame })).toEqual({
      cameraY: -90,
      cameraX: -18,
    });
  });

  it("rolls the camera with the modifier in orbit mode", () => {
    expect(dragProperties({ mode: "orbit", start, dx: 80, dy: 300, frame, roll: true })).toEqual({
      cameraZ: 18,
    });
  });

  it("stops orbiting at straight down rather than flipping over", () => {
    expect(dragProperties({ mode: "orbit", start, dx: 0, dy: 400, frame }).cameraX).toBe(90);
  });

  it("turns the device towards the drag in rotate mode", () => {
    expect(dragProperties({ mode: "rotate", start, dx: 400, dy: -45, frame })).toEqual({
      rotateY: 90,
      rotateX: -18,
    });
  });

  it("rolls the device with the modifier in rotate mode", () => {
    expect(dragProperties({ mode: "rotate", start, dx: 80, dy: 300, frame, roll: true })).toEqual({
      rotateZ: -18,
    });
  });

  it("clamps to the property ranges", () => {
    const turned = { ...start, rotateY: 170 };
    expect(dragProperties({ mode: "rotate", start: turned, dx: 400, dy: 0, frame }).rotateY).toBe(180);
  });
});

describe("wheelZoom", () => {
  it("zooms in when scrolling up and out when scrolling down", () => {
    expect(wheelZoom(1, -500)).toEqual({ zoom: 2 });
    expect(wheelZoom(1, 500)).toEqual({ zoom: 0.5 });
    expect(wheelZoom(0.1, 5000).zoom).toBe(0.1);
  });
});

describe("resetProperties", () => {
  it("resets what each mode drags", () => {
    expect(resetProperties("camera")).toEqual({ panX: 0, panY: 0, zoom: 1 });
    expect(resetProperties("orbit")).toEqual({ cameraX: 0, cameraY: 0, cameraZ: 0 });
    expect(resetProperties("rotate")).toEqual({ rotateX: 0, rotateY: 0, rotateZ: 0 });
  });
});

describe("dragTarget", () => {
  const entry = (id: string, kind: "import" | "text") => ({
    clip: {
      id,
      name: id,
      start: 0,
      duration: 4,
      transitionIn: "cut" as const,
      properties: {},
      source:
        kind === "text"
          ? { kind: "text" as const, text: id, size: "title" as const, align: "center" as const, weight: 600 }
          : { kind: "import" as const, file: "a.mp4", trimStart: 0, fileDuration: 4, width: 16, height: 9 },
    },
    trackIndex: 0,
    localTime: 0,
    presence: 1,
    transition: null,
  });
  const active = [entry("bottom", "import"), entry("top", "import"), entry("title", "text")];

  it("prefers the selected visible video clip, else the topmost video clip", () => {
    expect(dragTarget(active, "bottom")?.clip.id).toBe("bottom");
    expect(dragTarget(active, "title")?.clip.id).toBe("top");
    expect(dragTarget(active, null)?.clip.id).toBe("top");
    expect(dragTarget([], null)).toBeNull();
  });
});
