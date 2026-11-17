import type { TextEffectTarget } from "../catalogues/text-effects/text-effect-schema";

/** One split part of a phrase; only animated units take part in the stagger. */
export type TextUnit = { text: string; animated: boolean };

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * Splits like the showcase's generic renderer: characters keep spaces as animated units, words animate only
 * non-space runs, lines come from the caller's measured line breaks (or explicit `\n` without them).
 */
export function splitTextUnits(
  text: string,
  target: TextEffectTarget,
  lines?: readonly string[]
): TextUnit[] {
  switch (target) {
    case "whole":
      return [{ text, animated: true }];
    case "per-character":
      return Array.from(graphemes.segment(text), ({ segment }) => ({
        text: segment,
        animated: segment !== "\n",
      }));
    case "per-word":
      return (text.match(/\S+|\s+/g) ?? []).map((part) => ({ text: part, animated: /\S/.test(part) }));
    case "per-line":
      return (lines ?? text.split("\n")).map((line) => ({ text: line, animated: true }));
  }
}

export function animatedUnitCount(units: readonly TextUnit[]): number {
  return units.filter((unit) => unit.animated).length;
}
