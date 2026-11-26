import { describe, expect, it } from "vitest";
import {
  gradientCss,
  normalizeHex,
  partnerStop,
  readBackground,
  shade,
  tint,
  toBackground,
} from "./background-fill";

describe("normalizeHex", () => {
  it("accepts short and long hex, with or without #", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("0b0b0c")).toBe("#0b0b0c");
    expect(normalizeHex("red")).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
  });
});

describe("shade", () => {
  it("mixes toward black", () => {
    expect(shade("#ffffff", 0.5)).toBe("#808080");
    expect(shade("#000000", 0.5)).toBe("#000000");
  });
});

describe("partnerStop", () => {
  it("lightens dark colours and darkens light ones, so a new gradient is visible", () => {
    expect(tint("#000000", 0.5)).toBe("#808080");
    expect(partnerStop("#0b0b0c")).toBe(tint("#0b0b0c", 0.18));
    expect(partnerStop("#fafafa")).toBe(shade("#fafafa", 0.25));
  });
});

describe("background round trip", () => {
  it("writes a two-stop linear gradient the stage can read back", () => {
    const fill = { kind: "gradient", from: "#27272a", to: "#050506", angle: 160 } as const;
    expect(gradientCss(fill)).toBe("linear-gradient(160deg, #27272a 0%, #050506 100%)");
    expect(readBackground(toBackground(fill))).toEqual(fill);
  });

  it("reads a colour, and a radial gradient as a vertical linear one", () => {
    expect(readBackground({ kind: "color", value: "#0b0b0c" })).toEqual({ kind: "color", color: "#0b0b0c" });
    expect(
      readBackground({
        kind: "gradient",
        value: "radial-gradient(120% 90% at 50% 0%, #52525b 0%, #09090b 70%)",
      })
    ).toEqual({ kind: "gradient", from: "#52525b", to: "#09090b", angle: 180 });
  });
});
