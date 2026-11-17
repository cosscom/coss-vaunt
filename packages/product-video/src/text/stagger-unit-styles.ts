import type { TextEffect, TextEffectPhase } from "../catalogues/text-effects/text-effect";
import { cssEasing } from "./css-easing";
import { staggerRanks } from "./stagger-ranks";
import type { TextUnit } from "./text-units";
import { frameStyle, mixFrames, REST_STYLE, type UnitStyle } from "./unit-style";

export type TextPhaseKind = "enter" | "exit";

/** Raw 0–1 progress of the unit in stagger slot `rank`, `elapsedMs` into the phase. */
export function staggeredProgress(
  phase: Pick<TextEffectPhase, "durationMs" | "staggerMs">,
  rank: number,
  elapsedMs: number
): number {
  const local = elapsedMs - rank * phase.staggerMs;
  if (phase.durationMs === 0) return local >= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, local / phase.durationMs));
}

export function staggerPhaseTotalMs(
  phase: Pick<TextEffectPhase, "durationMs" | "staggerMs">,
  animatedCount: number
): number {
  return phase.durationMs + Math.max(0, animatedCount - 1) * phase.staggerMs;
}

/**
 * The generic stagger renderer: each animated unit runs the phase from `from` to `to`, delayed by its stagger
 * slot, holding `from` before its delay and `to` after it ends. Non-animated units (word gaps) stay at rest.
 */
export function textUnitStyles(
  effect: TextEffect,
  phaseKind: TextPhaseKind,
  units: readonly TextUnit[],
  elapsedMs: number,
  pxScale: number
): UnitStyle[] {
  const phase = effect[phaseKind];
  const ease = cssEasing(phase.easing);
  const ranks = staggerRanks(units.filter((unit) => unit.animated).length, effect.staggerMode);
  let animatedIndex = 0;
  return units.map((unit) => {
    if (!unit.animated) return REST_STYLE;
    const rank = ranks[animatedIndex++];
    const progress = ease(staggeredProgress(phase, rank, elapsedMs));
    return frameStyle(mixFrames(phase.from, phase.to, progress), pxScale, effect.yTravelMultiplier);
  });
}
