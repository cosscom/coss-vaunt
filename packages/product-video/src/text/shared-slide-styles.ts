import type { TextEffect } from "../catalogues/text-effects/text-effect";
import { cssEasing } from "./css-easing";
import { staggeredProgress, type TextPhaseKind } from "./stagger-unit-styles";
import type { TextUnit } from "./text-units";
import { frameStyle, mixFrames, REST_STYLE, type UnitStyle } from "./unit-style";

type SharedSlideRenderer = Extract<TextEffect["renderer"], { id: "shared-slide-opacity-stage" }>;

export function sharedSlideEnterTotalMs(
  effect: TextEffect,
  renderer: SharedSlideRenderer,
  wordCount: number
): number {
  const lastWordEnd = Math.max(0, wordCount - 1) * effect.enter.staggerMs + renderer.wordOpacity.durationMs;
  return Math.max(effect.enter.durationMs, lastWordEnd);
}

/**
 * Short Slide Right: the whole phrase moves as one title-level transform while only word opacity staggers in.
 * The exit animates the title alone.
 */
export function sharedSlideStyles(
  effect: TextEffect,
  renderer: SharedSlideRenderer,
  phaseKind: TextPhaseKind,
  units: readonly TextUnit[],
  elapsedMs: number,
  pxScale: number
): { container: UnitStyle; units: UnitStyle[] } {
  const phase = effect[phaseKind];
  const ease = cssEasing(phase.easing);
  const titleProgress = ease(staggeredProgress({ durationMs: phase.durationMs, staggerMs: 0 }, 0, elapsedMs));
  const container = frameStyle(
    mixFrames(phase.from, phase.to, titleProgress),
    pxScale,
    effect.yTravelMultiplier
  );
  if (phaseKind === "exit") return { container, units: units.map(() => REST_STYLE) };

  const { durationMs, from, to } = renderer.wordOpacity;
  let wordIndex = 0;
  return {
    container,
    units: units.map((unit) => {
      if (!unit.animated) return REST_STYLE;
      const progress = ease(
        staggeredProgress({ durationMs, staggerMs: phase.staggerMs }, wordIndex++, elapsedMs)
      );
      const opacity = from + (to - from) * progress;
      return { ...REST_STYLE, opacity: Math.round(Math.min(1, Math.max(0, opacity)) * 1000) / 1000 };
    }),
  };
}
