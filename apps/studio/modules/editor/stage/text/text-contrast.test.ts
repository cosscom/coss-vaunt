import { describe, expect, it } from "vitest";
import { INK, PAPER, textColorForBackground } from "./text-contrast";

const settings = (value: string, theme: "light" | "dark" = "light") => ({
  theme,
  background: { kind: "color" as const, value },
});

describe("textColorForBackground", () => {
  it("uses paper on a dark background even in the light theme", () => {
    expect(textColorForBackground(settings("#0b0b0c", "light"))).toBe(PAPER);
  });

  it("uses ink on a light background even in the dark theme", () => {
    expect(textColorForBackground(settings("#fafafa", "dark"))).toBe(INK);
  });

  it("averages the stops of a gradient", () => {
    expect(textColorForBackground(settings("linear-gradient(160deg, #27272a 0%, #050506 100%)"))).toBe(PAPER);
    expect(textColorForBackground(settings("linear-gradient(160deg, #e0e7ff 0%, #f4f4f5 60%)"))).toBe(INK);
  });

  it("falls back to the theme without hex colours", () => {
    expect(textColorForBackground(settings("rebeccapurple", "dark"))).toBe(PAPER);
  });
});
