import { listTextEffects } from "@coss/vaunt-engine/catalogues/text-effects/text-effect-catalogue";
import { describe, expect, it } from "vitest";
import { groupTextEffects } from "./text-effect-groups";

describe("groupTextEffects", () => {
  it("groups every catalogue effect by target, letters first", () => {
    const groups = groupTextEffects(listTextEffects());
    expect(groups.map((group) => group.target)).toEqual(["per-character", "per-word", "per-line", "whole"]);
    expect(groups.flatMap((group) => group.effects)).toHaveLength(listTextEffects().length);
    expect(groups[2].effects.map((effect) => effect.id)).toEqual(["mask-reveal-up", "line-by-line-slide"]);
  });

  it("drops empty groups", () => {
    const whole = listTextEffects().filter((effect) => effect.target === "whole");
    expect(groupTextEffects(whole).map((group) => group.target)).toEqual(["whole"]);
  });
});
