import type { TextEffect } from "../catalogues/text-effects/text-effect";
import type { TextEffectTarget } from "../catalogues/text-effects/text-effect-schema";
import { kineticBuildStyles, kineticEnterTotalMs, type WordSize } from "./kinetic-build-styles";
import { sharedSlideEnterTotalMs, sharedSlideStyles } from "./shared-slide-styles";
import { staggerPhaseTotalMs, textUnitStyles } from "./stagger-unit-styles";
import { textPhaseAt } from "./text-clip-timeline";
import { animatedUnitCount, splitTextUnits, type TextUnit } from "./text-units";
import { REST_STYLE, type UnitStyle } from "./unit-style";

/** Font size the showcase's pixel offsets were authored at; offsets and blur scale by `fontSize / this`. */
export const SHOWCASE_FONT_PX = 48;

/** Layout read from the rendered text, in frame pixels; missing values fall back to explicit breaks and estimates. */
export type TextLayoutMeasurements = {
  /** Visual lines of the phrase at its rendered width. */
  lines?: readonly string[];
  /** Size of every word (non-space run), in order. */
  wordSizes?: readonly WordSize[];
};

export type TextEffectFrameInput = {
  text: string;
  effectIn: TextEffect | undefined;
  effectOut: TextEffect | undefined;
  /** Seconds since the clip started. */
  localTime: number;
  clipDuration: number;
  /** Frame pixels per showcase pixel. */
  pxScale: number;
  measurements?: TextLayoutMeasurements;
};

export type StyledTextUnit = TextUnit & { style: UnitStyle };

/** Inline text split per target inside one container (the title). */
export type FlowTextFrame = {
  layout: "flow";
  target: TextEffectTarget;
  container: UnitStyle;
  units: StyledTextUnit[];
};

/** Absolutely centred words in a box of the given size (frame pixels). */
export type KineticTextFrame = {
  layout: "kinetic-line" | "kinetic-stack";
  width: number;
  height: number;
  units: StyledTextUnit[];
};

export type TextEffectFrame = FlowTextFrame | KineticTextFrame;

function unitsFor(
  effect: TextEffect | undefined,
  text: string,
  measurements?: TextLayoutMeasurements
): TextUnit[] {
  return splitTextUnits(text, effect?.target ?? "whole", measurements?.lines);
}

function wordSizes(units: readonly TextUnit[], pxScale: number, measured?: readonly WordSize[]): WordSize[] {
  const words = units.filter((unit) => unit.animated);
  if (measured && measured.length === words.length) return [...measured];
  const em = SHOWCASE_FONT_PX * pxScale;
  return words.map((word) => ({ width: word.text.length * em * 0.55, height: em * 1.1 }));
}

function phaseTotalMs(effect: TextEffect, phase: "enter" | "exit", units: readonly TextUnit[]): number {
  const count = animatedUnitCount(units);
  const { renderer } = effect;
  if (renderer.id === "kinetic-center-build" || renderer.id === "kinetic-top-build") {
    return phase === "enter" ? kineticEnterTotalMs(renderer.build, count) : renderer.build.exitMs;
  }
  if (renderer.id === "shared-slide-opacity-stage") {
    return phase === "enter" ? sharedSlideEnterTotalMs(effect, renderer, count) : effect.exit.durationMs;
  }
  return staggerPhaseTotalMs(effect[phase], count);
}

/** How long the enter and exit take for this text, before any squeeze to fit a short clip. */
export function textEffectTotalsMs(
  input: Pick<TextEffectFrameInput, "text" | "effectIn" | "effectOut" | "measurements">
): { enterMs: number; exitMs: number } {
  const { text, effectIn, effectOut, measurements } = input;
  return {
    enterMs: effectIn ? phaseTotalMs(effectIn, "enter", unitsFor(effectIn, text, measurements)) : 0,
    exitMs: effectOut ? phaseTotalMs(effectOut, "exit", unitsFor(effectOut, text, measurements)) : 0,
  };
}

/**
 * The text of a clip at one moment: which split to render and each unit's inline style. A pure function of
 * clip-local time, so the player and the exporter draw the same frame for the same time.
 */
export function evaluateTextEffect(input: TextEffectFrameInput): TextEffectFrame {
  const { effectIn, effectOut, text, pxScale, measurements } = input;
  const enterUnits = unitsFor(effectIn, text, measurements);
  const exitUnits = unitsFor(effectOut, text, measurements);
  const totals = textEffectTotalsMs(input);
  const phase = textPhaseAt({
    effectIn,
    enterTotalMs: totals.enterMs,
    effectOut,
    exitTotalMs: totals.exitMs,
    localTimeMs: input.localTime * 1000,
    clipDurationMs: input.clipDuration * 1000,
  });
  const effect = phase.effect;
  const units = phase.kind === "exit" ? exitUnits : enterUnits;
  if (!effect)
    return {
      layout: "flow",
      target: "whole",
      container: REST_STYLE,
      units: [{ ...units[0], style: REST_STYLE }],
    };

  const elapsedMs = phase.kind === "rest" ? 0 : phase.elapsedMs;
  const { renderer } = effect;
  if (renderer.id === "kinetic-center-build" || renderer.id === "kinetic-top-build") {
    const words = units.filter((unit) => unit.animated);
    const kinetic = kineticBuildStyles(
      renderer,
      phase.kind,
      wordSizes(units, pxScale, measurements?.wordSizes),
      elapsedMs,
      pxScale
    );
    return {
      layout: renderer.id === "kinetic-center-build" ? "kinetic-line" : "kinetic-stack",
      width: kinetic.width,
      height: kinetic.height,
      units: words.map((word, index) => ({ ...word, style: kinetic.units[index] })),
    };
  }
  if (phase.kind === "rest") {
    return {
      layout: "flow",
      target: effect.target,
      container: REST_STYLE,
      units: units.map((unit) => ({ ...unit, style: REST_STYLE })),
    };
  }
  if (renderer.id === "shared-slide-opacity-stage") {
    const styles = sharedSlideStyles(effect, renderer, phase.kind, units, elapsedMs, pxScale);
    return {
      layout: "flow",
      target: effect.target,
      container: styles.container,
      units: units.map((unit, index) => ({ ...unit, style: styles.units[index] })),
    };
  }
  const styles = textUnitStyles(effect, phase.kind, units, elapsedMs, pxScale);
  return {
    layout: "flow",
    target: effect.target,
    container: REST_STYLE,
    units: units.map((unit, index) => ({ ...unit, style: styles[index] })),
  };
}
