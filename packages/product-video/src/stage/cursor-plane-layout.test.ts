import { describe, expect, it } from "vitest";
import { CURSOR_SHAPES, cursorPlaneLayout, PRESSED_SCALE } from "./cursor-plane-layout";

const viewport = { width: 1000, height: 500 };
const arrow = { size: 1, style: "arrow" as const };

/** The plane point under the shape's hotspot, which must be the sample. */
function hotspotOf(sprite: { x: number; y: number; width: number; height: number }, style: "arrow" | "dot") {
  const { u, v } = CURSOR_SHAPES[style].hotspot;
  return { x: sprite.x + (u - 0.5) * sprite.width, y: sprite.y - (v - 0.5) * sprite.height };
}

describe("cursorPlaneLayout", () => {
  it("puts the hotspot on the sample, with y up and the plane centred", () => {
    const { sprite, ripple } = cursorPlaneLayout({ x: 750, y: 125, press: 0, ripple: null }, arrow, viewport);
    const hotspot = hotspotOf(sprite, "arrow");
    expect(hotspot.x).toBeCloseTo(0.25);
    expect(hotspot.y).toBeCloseTo(0.25);
    expect(sprite.width * viewport.width).toBeCloseTo(CURSOR_SHAPES.arrow.side);
    expect(sprite.height * viewport.height).toBeCloseTo(CURSOR_SHAPES.arrow.side);
    expect(ripple).toBeNull();
  });

  it("shrinks about the hotspot when pressed and grows with size", () => {
    const pressed = cursorPlaneLayout({ x: 500, y: 250, press: 1, ripple: null }, arrow, viewport).sprite;
    expect(pressed.width * viewport.width).toBeCloseTo(CURSOR_SHAPES.arrow.side * PRESSED_SCALE);
    expect(hotspotOf(pressed, "arrow").x).toBeCloseTo(0);
    expect(hotspotOf(pressed, "arrow").y).toBeCloseTo(0);
    const large = cursorPlaneLayout(
      { x: 500, y: 250, press: 0, ripple: null },
      { ...arrow, size: 2 },
      viewport
    );
    expect(large.sprite.width * viewport.width).toBeCloseTo(CURSOR_SHAPES.arrow.side * 2);
  });

  it("expands the ripple from the click point and fades it out", () => {
    const at = (progress: number) =>
      cursorPlaneLayout({ x: 500, y: 250, press: 1, ripple: { x: 500, y: 250, progress } }, arrow, viewport)
        .ripple;
    const start = at(0);
    const late = at(0.8);
    expect(start).toMatchObject({ x: 0, y: 0 });
    expect(late?.width ?? 0).toBeGreaterThan(start?.width ?? 0);
    expect(late?.opacity ?? 1).toBeLessThan(start?.opacity ?? 0);
    expect(at(1)?.opacity).toBe(0);
  });
});
