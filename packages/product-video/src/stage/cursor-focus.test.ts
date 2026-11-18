import { describe, expect, it } from "vitest";
import { evaluateClipProperties } from "../storyboard/property-evaluation";
import { type CursorSource, cursorFocusAt, withBlurOnCursor } from "./cursor-focus";
import { createCursorTrack } from "./cursor-track";

const viewport = { width: 1000, height: 500 };
function source(points: Array<[number, number] | null>): CursorSource {
  const samples = points.map((point) =>
    point
      ? { x: point[0], y: point[1], pressed: false, visible: true }
      : { x: 0, y: 0, pressed: false, visible: false }
  );
  const track = createCursorTrack(samples, 10);
  if (!track) throw new Error("no track");
  return { track, viewport };
}

describe("cursorFocusAt", () => {
  it("puts the cursor on the device in device fractions", () => {
    expect(cursorFocusAt(source([[750, 125]]), 0, 0)).toEqual({ x: 0.5, y: -0.5 });
  });

  it("averages over the window, so a jump arrives gradually", () => {
    const jump = source([...Array(10).fill([0, 250]), ...Array(10).fill([1000, 250])]);
    const before = cursorFocusAt(jump, 0.5, 1.2)?.x ?? 0;
    const middle = cursorFocusAt(jump, 0.95, 1.2)?.x ?? 0;
    const after = cursorFocusAt(jump, 1.6, 1.2)?.x ?? 0;
    expect(before).toBeLessThan(middle);
    expect(middle).toBeLessThan(after);
    expect(middle).toBeGreaterThan(-0.5);
    expect(middle).toBeLessThan(0.5);
  });

  it("is null while the cursor is hidden", () => {
    expect(cursorFocusAt(source([null, null, [500, 250]]), 0, 0.1)).toBeNull();
  });
});

describe("withBlurOnCursor", () => {
  const values = evaluateClipProperties({ properties: {} }, 0);
  const cursor = source([[750, 125]]);
  const blur = { enabled: true, mode: "radial" as const, focus: "auto" as const };

  it("moves the blur focus onto the cursor only when the blur follows it", () => {
    expect(withBlurOnCursor({ blur: { ...blur, followCursor: true } }, values, 0, cursor)).toMatchObject({
      focusX: 0.5,
      focusY: -0.5,
    });
    expect(withBlurOnCursor({ blur }, values, 0, cursor)).toBe(values);
  });
});
