import { describe, expect, it } from "vitest";
import { linearGradientLine, parseBackgroundGradient } from "./background-gradient";

describe("parseBackgroundGradient", () => {
  it("parses a linear gradient with an angle and stops", () => {
    expect(parseBackgroundGradient("linear-gradient(160deg, #27272a 0%, #050506 100%)")).toEqual({
      kind: "linear",
      angle: 160,
      stops: [
        { color: "#27272a", offset: 0 },
        { color: "#050506", offset: 1 },
      ],
    });
  });

  it("parses a radial gradient's size, centre and colour functions", () => {
    expect(
      parseBackgroundGradient("radial-gradient(120% 90% at 50% 0%, rgb(82, 82, 91) 0%, #09090b 70%)")
    ).toEqual({
      kind: "radial",
      radiusX: 1.2,
      radiusY: 0.9,
      centerX: 0.5,
      centerY: 0,
      stops: [
        { color: "rgb(82, 82, 91)", offset: 0 },
        { color: "#09090b", offset: 0.7 },
      ],
    });
  });

  it("spreads stops without positions and defaults the angle to top-to-bottom", () => {
    expect(parseBackgroundGradient("linear-gradient(#fff, #000, #f00)")).toMatchObject({
      angle: 180,
      stops: [{ offset: 0 }, { offset: 0.5 }, { offset: 1 }],
    });
  });

  it("rejects anything else", () => {
    expect(parseBackgroundGradient("#0b0b0c")).toBeNull();
    expect(parseBackgroundGradient("linear-gradient(160deg, #fff)")).toBeNull();
  });
});

describe("linearGradientLine", () => {
  it("runs top to bottom at 180deg and corner to corner on a square at 135deg", () => {
    const vertical = linearGradientLine(180, 100, 50);
    expect(vertical.x0).toBeCloseTo(50);
    expect(vertical.y0).toBeCloseTo(0);
    expect(vertical.y1).toBeCloseTo(50);
    const diagonal = linearGradientLine(135, 100, 100);
    expect(diagonal.x0).toBeCloseTo(0);
    expect(diagonal.y0).toBeCloseTo(0);
    expect(diagonal.x1).toBeCloseTo(100);
    expect(diagonal.y1).toBeCloseTo(100);
  });
});
