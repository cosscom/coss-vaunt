import { describe, expect, it } from "vitest";
import { applyHomography, fitHomography } from "./homography";

describe("fitHomography", () => {
  it("maps a quad onto a square and points inside it in between", () => {
    const quad: Array<[number, number]> = [
      [10, 10],
      [90, 20],
      [80, 80],
      [20, 70],
    ];
    const square: Array<[number, number]> = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const h = fitHomography(quad, square);
    if (!h) throw new Error("no fit");
    quad.forEach((corner, index) => {
      const mapped = applyHomography(h, corner);
      expect([mapped.x, mapped.y]).toEqual([
        expect.closeTo(square[index][0]),
        expect.closeTo(square[index][1]),
      ]);
    });
    const middle = applyHomography(h, [50, 45]);
    expect(middle.x).toBeGreaterThan(0);
    expect(middle.x).toBeLessThan(1);
  });

  it("refuses points in a line", () => {
    const line: Array<[number, number]> = [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ];
    expect(fitHomography(line, line)).toBeNull();
  });
});
