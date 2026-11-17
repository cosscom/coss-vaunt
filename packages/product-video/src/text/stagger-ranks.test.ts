import { describe, expect, it } from "vitest";
import { staggerRanks } from "./stagger-ranks";

describe("staggerRanks", () => {
  it("orders normally and in reverse", () => {
    expect(staggerRanks(4, "normal")).toEqual([0, 1, 2, 3]);
    expect(staggerRanks(4, "reverse")).toEqual([3, 2, 1, 0]);
  });

  it("starts from the centre, breaking ties towards the lower index", () => {
    expect(staggerRanks(5, "center-out")).toEqual([3, 1, 0, 2, 4]);
    expect(staggerRanks(4, "center-out")).toEqual([2, 0, 1, 3]);
  });

  it("alternates left and right edges moving inwards", () => {
    expect(staggerRanks(5, "edges-in")).toEqual([0, 2, 4, 3, 1]);
    expect(staggerRanks(1, "edges-in")).toEqual([0]);
  });
});
