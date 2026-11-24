import { createTextClip } from "@coss/vaunt-engine/storyboard/storyboard-factories";
import { describe, expect, it } from "vitest";
import { transitionRegions } from "./transition-regions";

const clip = (id: string, start: number) => ({ ...createTextClip({ text: id, start }), id });

describe("transitionRegions", () => {
  it("returns one region per overlap, owned by the incoming clip", () => {
    const regions = transitionRegions({ clips: [clip("b", 2.4), clip("a", 0), clip("c", 6)] });
    expect(regions).toEqual([{ clipId: "b", outgoingClipId: "a", start: 2.4, end: 3, kind: "crossfade" }]);
  });
});
