import { describe, expect, it } from "vitest";
import { CORNER_PX, cardSegments, FADE_PX, segmentMask } from "./card-edge";

// A horizontal gap above the timeline, 1000 px wide at x 0, between y 500 and 510.
const timelineGap = { left: 0, top: 500, right: 1000, bottom: 510 };

describe("cardSegments", () => {
  it("keeps one segment per card above, skipping the gaps between them", () => {
    const cards = [
      { left: 0, top: 0, right: 270, bottom: 500 },
      { left: 280, top: 0, right: 700, bottom: 500 },
      { left: 710, top: 0, right: 1000, bottom: 500 },
      // The timeline itself is on the other side.
      { left: 0, top: 510, right: 1000, bottom: 800 },
    ];
    expect(cardSegments(timelineGap, cards, false, "before")).toEqual([
      { start: 0, end: 270 },
      { start: 280, end: 700 },
      { start: 710, end: 1000 },
    ]);
    expect(cardSegments(timelineGap, cards, false, "after")).toEqual([{ start: 0, end: 1000 }]);
  });

  it("ignores cards that aren't against the gap, and ones too short to clear their corners", () => {
    const cards = [
      { left: 0, top: 0, right: 500, bottom: 480 },
      { left: 600, top: 0, right: 620, bottom: 500 },
    ];
    expect(cardSegments(timelineGap, cards, false, "before")).toEqual([]);
  });

  it("measures a vertical gap along its height, clipped to the gap", () => {
    const gap = { left: 300, top: 50, right: 310, bottom: 850 };
    const cards = [{ left: 0, top: 0, right: 300, bottom: 900 }];
    expect(cardSegments(gap, cards, true, "before")).toEqual([{ start: 0, end: 800 }]);
  });
});

describe("segmentMask", () => {
  it("fades in after each corner and out before the next", () => {
    const mask = segmentMask([{ start: 0, end: 200 }], false);
    expect(mask).toBe(
      `linear-gradient(to right, transparent 0px, transparent ${CORNER_PX}px, #000 ${CORNER_PX + FADE_PX}px, ` +
        `#000 ${200 - CORNER_PX - FADE_PX}px, transparent ${200 - CORNER_PX}px, transparent 100%)`
    );
  });

  it("shortens the fade on a short segment so its stops stay in order", () => {
    const mask = segmentMask([{ start: 0, end: 60 }], true);
    expect(mask).toContain("transparent 14px, #000 30px, #000 30px, transparent 46px");
  });

  it("hides everything when no card is against the gap", () => {
    expect(segmentMask([], true)).toBe("linear-gradient(transparent, transparent)");
  });
});
