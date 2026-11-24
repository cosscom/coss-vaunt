import type { TextEffect } from "@coss/vaunt-engine/catalogues/text-effects/text-effect";

const GROUP_ORDER = ["per-character", "per-word", "per-line", "whole"] as const;

export type TextEffectGroup = { target: TextEffect["target"]; effects: TextEffect[] };

/** Effects grouped by what they split into, letters first; empty groups are left out. */
export function groupTextEffects(effects: readonly TextEffect[]): TextEffectGroup[] {
  return GROUP_ORDER.map((target) => ({
    target,
    effects: effects.filter((effect) => effect.target === target),
  })).filter((group) => group.effects.length > 0);
}
