import type { KineticBuild, TextEffect } from "../catalogues/text-effects/text-effect";
import { cssEasing } from "./css-easing";
import { keyframeValue, kineticWordStyle, type UnitStyle } from "./unit-style";

export type KineticRenderer = Extract<
  TextEffect["renderer"],
  { id: "kinetic-center-build" | "kinetic-top-build" }
>;

/** A word's laid-out size in frame pixels. */
export type WordSize = { width: number; height: number };

/**
 * One keyframe of a word: `along` is its position on the build axis (x for the line, y for the stack) and
 * `drop` an extra y offset, both frame pixels; `blur` is showcase pixels.
 */
type Stop = { offset: number; along: number; drop: number; scale: number; blur: number; opacity: number };

const HIDDEN: UnitStyle = { opacity: 0, transform: "translate(-50%, -50%)", filter: "none" };

const mix = (from: number, to: number, amount: number): number => from + (to - from) * amount;

/** Centre offsets of words laid out along one axis with `gap` between them, centred on 0. */
export function centredPositions(lengths: readonly number[], gap: number): number[] {
  const total = lengths.reduce((sum, length) => sum + length, 0) + gap * Math.max(0, lengths.length - 1);
  let cursor = -total / 2;
  return lengths.map((length) => {
    const position = cursor + length / 2;
    cursor += length + gap;
    return position;
  });
}

export function kineticEnterTotalMs(build: KineticBuild, wordCount: number): number {
  if (wordCount === 0) return 0;
  return build.firstWordMs + (wordCount - 1) * build.pushMs;
}

const rest = (along: number): Stop[] => [{ offset: 0, along, drop: 0, scale: 1, blur: 0, opacity: 1 }];

// The stop tables below are the recipe's `keyframe_recipe`, offsets and mixes unchanged.
function firstWordStops(build: KineticBuild, pxScale: number): Stop[] {
  const y = build.firstWordYPx * pxScale;
  return [
    { offset: 0, along: 0, drop: y, scale: build.entryScale, blur: build.entryBlurPx, opacity: 0 },
    { offset: 0.58, along: 0, drop: y * 0.35, scale: 0.998, blur: build.entryBlurPx * 0.45, opacity: 0.78 },
    { offset: 1, along: 0, drop: 0, scale: 1, blur: 0, opacity: 1 },
  ];
}

function reflowStops(build: KineticBuild, current: number, next: number): Stop[] {
  return [
    { offset: 0, along: current, drop: 0, scale: 1, blur: 0, opacity: 1 },
    {
      offset: 0.52,
      along: mix(current, next, 0.58),
      drop: 0,
      scale: 1,
      blur: build.reflowBlurPx,
      opacity: 1,
    },
    { offset: 1, along: next, drop: 0, scale: 1, blur: 0, opacity: 1 },
  ];
}

function incomingStops(build: KineticBuild, target: number, pxScale: number): Stop[] {
  const start = target + build.entryOffsetPx * pxScale;
  return [
    { offset: 0, along: start, drop: 0, scale: build.entryScale, blur: build.entryBlurPx, opacity: 0 },
    {
      offset: 0.6,
      along: mix(start, target, 0.72),
      drop: 0,
      scale: 0.998,
      blur: build.entryBlurPx * 0.38,
      opacity: 0.84,
    },
    { offset: 1, along: target, drop: 0, scale: 1, blur: 0, opacity: 1 },
  ];
}

function exitStops(build: KineticBuild, position: number, pxScale: number): Stop[] {
  const y = build.exitYPx * pxScale;
  return [
    { offset: 0, along: position, drop: 0, scale: 1, blur: 0, opacity: 1 },
    { offset: 0.52, along: position, drop: y * 0.45, scale: 1, blur: build.exitBlurPx * 0.55, opacity: 0.62 },
    { offset: 1, along: position, drop: y, scale: 1, blur: build.exitBlurPx, opacity: 0 },
  ];
}

/** Each word's stops and the eased progress through them at `elapsedMs` into the phase. */
function phaseStops(
  build: KineticBuild,
  phase: "enter" | "exit" | "rest",
  lengths: readonly number[],
  gap: number,
  elapsedMs: number,
  pxScale: number
): { progress: number; words: (Stop[] | null)[] } {
  const finals = centredPositions(lengths, gap);
  if (phase === "rest") return { progress: 1, words: finals.map(rest) };
  if (phase === "exit") {
    const linear = build.exitMs === 0 ? 1 : Math.min(1, Math.max(0, elapsedMs / build.exitMs));
    return {
      progress: cssEasing(build.exitEasing)(linear),
      words: finals.map((at) => exitStops(build, at, pxScale)),
    };
  }

  const ease = cssEasing(build.easing);
  if (elapsedMs < build.firstWordMs) {
    return {
      progress: ease(Math.max(0, elapsedMs / build.firstWordMs)),
      words: lengths.map((_, index) => (index === 0 ? firstWordStops(build, pxScale) : null)),
    };
  }
  const push =
    build.pushMs === 0 ? lengths.length : Math.floor((elapsedMs - build.firstWordMs) / build.pushMs);
  if (push >= lengths.length - 1) return { progress: 1, words: finals.map(rest) };

  const incoming = push + 1;
  const current = centredPositions(lengths.slice(0, incoming), gap);
  const next = centredPositions(lengths.slice(0, incoming + 1), gap);
  return {
    progress: ease((elapsedMs - build.firstWordMs - push * build.pushMs) / build.pushMs),
    words: lengths.map((_, index) => {
      if (index < incoming) return reflowStops(build, current[index], next[index]);
      if (index === incoming) return incomingStops(build, next[index], pxScale);
      return null;
    }),
  };
}

/**
 * Pixel Point's kinetic builds: words enter one at a time (from the right on a centred line, or from above
 * on a centred stack), each push reflowing the words already placed, then all exit together. Easing applies
 * across each animation, with the stops interpolated linearly in eased progress as WAAPI does.
 */
export function kineticBuildStyles(
  renderer: KineticRenderer,
  phase: "enter" | "exit" | "rest",
  sizes: readonly WordSize[],
  elapsedMs: number,
  pxScale: number
): { width: number; height: number; units: UnitStyle[] } {
  const horizontal = renderer.id === "kinetic-center-build";
  const lengths = sizes.map((size) => (horizontal ? size.width : size.height));
  const gap = renderer.build.gapPx * pxScale;
  const along = lengths.reduce((sum, length) => sum + length, 0) + gap * Math.max(0, sizes.length - 1);
  const across = Math.max(0, ...sizes.map((size) => (horizontal ? size.height : size.width)));
  const box = horizontal ? { width: along, height: across } : { width: across, height: along };
  if (sizes.length === 0) return { ...box, units: [] };

  const { progress, words } = phaseStops(renderer.build, phase, lengths, gap, elapsedMs, pxScale);
  const units = words.map((stops) => {
    if (!stops) return HIDDEN;
    const value = (key: Exclude<keyof Stop, "offset">): number =>
      keyframeValue(
        stops.map((stop) => [stop.offset, stop[key]] as const),
        progress
      );
    const position = value("along");
    const drop = value("drop");
    return kineticWordStyle({
      x: horizontal ? position : 0,
      y: horizontal ? drop : position + drop,
      scale: value("scale"),
      blur: value("blur") * pxScale,
      opacity: value("opacity"),
    });
  });
  return { ...box, units };
}
