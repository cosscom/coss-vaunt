import { describe, expect, it } from "vitest";
import type { TextEffect } from "../catalogues/text-effects/text-effect";
import { getTextEffect } from "../catalogues/text-effects/text-effect-catalogue";
import { evaluateTextEffect, type KineticTextFrame, type TextEffectFrameInput } from "./evaluate-text-effect";

function effect(id: string): TextEffect {
  const found = getTextEffect(id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

const base = { pxScale: 1, clipDuration: 4 } satisfies Partial<TextEffectFrameInput>;

const at = (input: Omit<TextEffectFrameInput, keyof typeof base> & Partial<TextEffectFrameInput>) =>
  evaluateTextEffect({ ...base, ...input });

describe("evaluateTextEffect, per-character", () => {
  const rise = effect("per-character-rise");

  it("holds every letter at the enter's from frame at 0", () => {
    const frame = at({ text: "Cal", effectIn: rise, effectOut: undefined, localTime: 0 });
    expect(frame.layout).toBe("flow");
    expect(frame.units.map((unit) => unit.style)).toEqual(
      Array(3).fill({ opacity: 0, transform: "translate3d(0px, 18.56px, 0px)", filter: "none" })
    );
  });

  it("staggers letters in order: earlier letters are further along", () => {
    const frame = at({ text: "Cal", effectIn: rise, effectOut: undefined, localTime: 0.1 });
    const [c, a, l] = frame.units.map((unit) => unit.style.opacity);
    expect(c).toBeGreaterThan(a);
    expect(a).toBeGreaterThan(l);
  });

  it("is at rest with no transform or filter once the last letter lands", () => {
    // enter: 504 ms per letter plus 2 × 17 ms stagger
    const frame = at({ text: "Cal", effectIn: rise, effectOut: undefined, localTime: 0.539 });
    expect(frame.units.every((unit) => unit.style.transform === "none" && unit.style.opacity === 1)).toBe(
      true
    );
  });

  it("ends the exit exactly at the clip's end", () => {
    const end = at({ text: "Cal", effectIn: undefined, effectOut: rise, localTime: 3.9999 });
    expect(end.units.every((unit) => unit.style.opacity < 0.01)).toBe(true);
    // exit: 302 ms per letter plus 2 × 10 ms stagger
    const beforeExit = at({ text: "Cal", effectIn: undefined, effectOut: rise, localTime: 4 - 0.323 });
    expect(
      beforeExit.units.every((unit) => unit.style.opacity === 1 && unit.style.transform === "none")
    ).toBe(true);
  });

  it("scales travel and blur with the frame", () => {
    const blur = effect("soft-blur-in");
    const small = at({ text: "A", effectIn: blur, effectOut: undefined, localTime: 0 });
    const large = at({ text: "A", effectIn: blur, effectOut: undefined, localTime: 0, pxScale: 2 });
    expect(small.units[0].style.filter).toBe("blur(12px)");
    expect(large.units[0].style.filter).toBe("blur(24px)");
    expect(large.units[0].style.transform).toBe("translate3d(0px, 18.56px, 0px)");
  });
});

describe("evaluateTextEffect, typewriter", () => {
  it("reveals one letter per stagger step with a hard cut", () => {
    const typewriter = effect("typewriter");
    // 33 ms stagger, 173 ms stepped duration: letter i appears at i × 33 + 173 ms
    const frame = at({ text: "abcd", effectIn: typewriter, effectOut: undefined, localTime: 0.24 });
    expect(frame.units.map((unit) => unit.style.opacity)).toEqual([1, 1, 1, 0]);
  });
});

describe("evaluateTextEffect, per-word", () => {
  it("leaves the gaps alone and staggers the words", () => {
    const crossfade = effect("per-word-crossfade");
    const frame = at({ text: "Book a call", effectIn: crossfade, effectOut: undefined, localTime: 0.08 });
    expect(frame.units.map((unit) => unit.text)).toEqual(["Book", " ", "a", " ", "call"]);
    expect(frame.units[1].style).toEqual({ opacity: 1, transform: "none", filter: "none" });
    expect(frame.units[0].style.opacity).toBeGreaterThan(frame.units[2].style.opacity);
    expect(frame.units[4].style.opacity).toBe(0);
  });

  it("overshoots scale with a spring easing", () => {
    const spring = effect("spring-scale-in");
    const scales = Array.from({ length: 26 }, (_, index) => {
      const style = at({ text: "Go", effectIn: spring, effectOut: undefined, localTime: index / 100 })
        .units[0].style;
      const match = /scale\(([\d.]+)\)/.exec(style.transform);
      return match ? Number(match[1]) : 1;
    });
    expect(Math.max(...scales)).toBeGreaterThan(1.02);
  });
});

describe("evaluateTextEffect, per-line", () => {
  it("animates measured lines in order", () => {
    const slide = effect("line-by-line-slide");
    const frame = at({
      text: "Schedule meetings without the back and forth",
      effectIn: slide,
      effectOut: undefined,
      localTime: 0.1,
      measurements: { lines: ["Schedule meetings", "without the back", "and forth"] },
    });
    expect(frame.units.map((unit) => unit.text)).toEqual([
      "Schedule meetings",
      "without the back",
      "and forth",
    ]);
    const [first, second, third] = frame.units.map((unit) => unit.style.opacity);
    expect(first).toBeGreaterThan(second);
    expect(second).toBeGreaterThan(third);
    expect(frame.units[0].style.transform).toMatch(/^translate3d\(-\d/);
  });
});

describe("evaluateTextEffect, whole and stagger modes", () => {
  it("animates the whole phrase as one unit", () => {
    const frame = at({
      text: "One unit",
      effectIn: effect("micro-scale-fade"),
      effectOut: undefined,
      localTime: 0,
    });
    expect(frame.units).toEqual([
      { text: "One unit", animated: true, style: { opacity: 0, transform: "scale(0.96)", filter: "none" } },
    ]);
  });

  it("reveals the centre letter first for stagger-from-center", () => {
    const frame = at({
      text: "abcde",
      effectIn: effect("stagger-from-center"),
      effectOut: undefined,
      localTime: 0.03,
    });
    const opacities = frame.units.map((unit) => unit.style.opacity);
    expect(opacities[2]).toBeGreaterThan(opacities[1]);
    expect(opacities[1]).toBeGreaterThan(opacities[0]);
  });
});

describe("evaluateTextEffect, timeline", () => {
  it("renders plain text at rest without effects", () => {
    const frame = at({ text: "Plain", effectIn: undefined, effectOut: undefined, localTime: 1 });
    expect(frame).toEqual({
      layout: "flow",
      target: "whole",
      container: { opacity: 1, transform: "none", filter: "none" },
      units: [{ text: "Plain", animated: true, style: { opacity: 1, transform: "none", filter: "none" } }],
    });
  });

  it("switches from the enter effect's split to the exit effect's split", () => {
    const options = {
      text: "Hi there",
      effectIn: effect("per-character-rise"),
      effectOut: effect("per-word-crossfade"),
    };
    expect(at({ ...options, localTime: 2 }).units).toHaveLength(8);
    expect(at({ ...options, localTime: 3.9 }).units).toHaveLength(3);
  });

  it("speeds both phases up when the clip is shorter than enter plus exit", () => {
    const fade = effect("fade-through");
    // enter 302 ms + exit 187 ms squeezed into 0.3 s
    const options = { text: "Quick", effectIn: fade, effectOut: fade, clipDuration: 0.3 };
    const enterEnd = (0.302 / (0.489 / 0.3)) * 1;
    expect(at({ ...options, localTime: enterEnd - 0.0001 }).units[0].style.opacity).toBeGreaterThan(0.99);
    expect(at({ ...options, localTime: enterEnd + 0.0001 }).units[0].style.opacity).toBe(1);
    expect(at({ ...options, localTime: 0.2999 }).units[0].style.opacity).toBeLessThan(0.01);
  });
});

describe("evaluateTextEffect, short slide right", () => {
  it("slides the whole title while words fade in one by one", () => {
    const slide = effect("short-slide-right");
    const frame = at({ text: "Glide in now", effectIn: slide, effectOut: undefined, localTime: 0.05 });
    expect(frame.layout === "flow" && frame.container.transform).toMatch(/^translate3d\(-/);
    const words = frame.units.filter((unit) => unit.animated).map((unit) => unit.style);
    expect(words[0].opacity).toBeGreaterThan(0);
    expect(words[2].opacity).toBe(0);
    expect(words.every((style) => style.transform === "none")).toBe(true);
  });
});

describe("evaluateTextEffect, kinetic builds", () => {
  const sizes = [
    { width: 100, height: 40 },
    { width: 60, height: 40 },
    { width: 80, height: 40 },
  ];
  const kinetic = (id: string, localTime: number) =>
    at({
      text: "Words push left",
      effectIn: effect(id),
      effectOut: effect(id),
      localTime,
      measurements: { wordSizes: sizes },
    }) as KineticTextFrame;

  it("starts with only the first word, centred", () => {
    const frame = kinetic("kinetic-center-build", 0);
    expect(frame.layout).toBe("kinetic-line");
    expect(frame.units[0].style).toEqual({
      opacity: 0,
      transform: "translate(-50%, -50%) translate3d(0px, 6px, 0px) scale(0.992)",
      filter: "blur(3.5px)",
    });
    expect(frame.units[1].style.opacity).toBe(0);
  });

  it("locks the full phrase centred once the build ends", () => {
    // first word 245 ms + 2 pushes of 310 ms
    const frame = kinetic("kinetic-center-build", 0.866);
    expect({ width: frame.width, height: frame.height }).toEqual({ width: 260, height: 40 });
    expect(frame.units.map((unit) => unit.style.transform)).toEqual([
      "translate(-50%, -50%) translate3d(-80px, 0px, 0px)",
      "translate(-50%, -50%) translate3d(10px, 0px, 0px)",
      "translate(-50%, -50%) translate3d(90px, 0px, 0px)",
    ]);
  });

  it("enters the next word from the right while the line reflows", () => {
    const frame = kinetic("kinetic-center-build", 0.245);
    expect(frame.units[1].style).toEqual({
      opacity: 0,
      transform: "translate(-50%, -50%) translate3d(143px, 0px, 0px) scale(0.992)",
      filter: "blur(3.5px)",
    });
    expect(frame.units[0].style.transform).toBe("translate(-50%, -50%) translate3d(0px, 0px, 0px)");
  });

  it("stacks words vertically for the top build", () => {
    const frame = kinetic("short-slide-down", 2);
    expect(frame.layout).toBe("kinetic-stack");
    expect({ width: frame.width, height: frame.height }).toEqual({ width: 100, height: 144 });
    expect(frame.units.map((unit) => unit.style.transform)).toEqual([
      "translate(-50%, -50%) translate3d(0px, -52px, 0px)",
      "translate(-50%, -50%) translate3d(0px, 0px, 0px)",
      "translate(-50%, -50%) translate3d(0px, 52px, 0px)",
    ]);
  });

  it("drops every word together on exit, gone at the clip's end", () => {
    const frame = kinetic("short-slide-down", 3.9999);
    expect(frame.units.every((unit) => unit.style.opacity < 0.01)).toBe(true);
    expect(frame.units[0].style.transform).toBe("translate(-50%, -50%) translate3d(0px, -42px, 0px)");
  });
});
