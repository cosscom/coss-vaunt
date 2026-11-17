import { describe, expect, it } from "vitest";
import { animatedUnitCount, splitTextUnits } from "./text-units";

describe("splitTextUnits", () => {
  it("keeps the whole phrase as one unit", () => {
    expect(splitTextUnits("Book faster", "whole")).toEqual([{ text: "Book faster", animated: true }]);
  });

  it("splits characters by grapheme and animates spaces as the showcase does", () => {
    const units = splitTextUnits("Hi 👋🏽!", "per-character");
    expect(units.map((unit) => unit.text)).toEqual(["H", "i", " ", "👋🏽", "!"]);
    expect(animatedUnitCount(units)).toBe(5);
  });

  it("animates only the words of a per-word split, keeping the gaps", () => {
    const units = splitTextUnits("Book  your call", "per-word");
    expect(units).toEqual([
      { text: "Book", animated: true },
      { text: "  ", animated: false },
      { text: "your", animated: true },
      { text: " ", animated: false },
      { text: "call", animated: true },
    ]);
  });

  it("uses measured lines when given, explicit breaks otherwise", () => {
    expect(
      splitTextUnits("One two three", "per-line", ["One two", "three"]).map((unit) => unit.text)
    ).toEqual(["One two", "three"]);
    expect(splitTextUnits("One\ntwo", "per-line").map((unit) => unit.text)).toEqual(["One", "two"]);
  });
});
