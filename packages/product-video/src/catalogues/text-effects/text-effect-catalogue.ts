import catalog from "./catalog.json";
import blurOutUp from "./specs/blur-out-up.json";
import bottomUpLetters from "./specs/bottom-up-letters.json";
import depthParallaxWords from "./specs/depth-parallax-words.json";
import fadeThrough from "./specs/fade-through.json";
import focusBlurResolve from "./specs/focus-blur-resolve.json";
import kineticCenterBuild from "./specs/kinetic-center-build.json";
import lineByLineSlide from "./specs/line-by-line-slide.json";
import maskRevealUp from "./specs/mask-reveal-up.json";
import microScaleFade from "./specs/micro-scale-fade.json";
import perCharacterRise from "./specs/per-character-rise.json";
import perWordCrossfade from "./specs/per-word-crossfade.json";
import scaleDownFade from "./specs/scale-down-fade.json";
import sharedAxisX from "./specs/shared-axis-x.json";
import sharedAxisY from "./specs/shared-axis-y.json";
import sharedAxisZ from "./specs/shared-axis-z.json";
import shimmerSweep from "./specs/shimmer-sweep.json";
import shortSlideDown from "./specs/short-slide-down.json";
import shortSlideRight from "./specs/short-slide-right.json";
import softBlurIn from "./specs/soft-blur-in.json";
import springScaleIn from "./specs/spring-scale-in.json";
import staggerFromCenter from "./specs/stagger-from-center.json";
import staggerFromEdges from "./specs/stagger-from-edges.json";
import topDownLetters from "./specs/top-down-letters.json";
import typewriter from "./specs/typewriter.json";
import type { KineticBuild, TextEffect, TextEffectPhase, TextEffectRenderer } from "./text-effect";
import {
  type TextEffectBuild,
  type TextEffectRendererId,
  type TextEffectSpec,
  textEffectCatalogSchema,
  textEffectSpecSchema,
} from "./text-effect-schema";

const RAW_TEXT_EFFECT_SPECS: readonly unknown[] = [
  blurOutUp,
  bottomUpLetters,
  depthParallaxWords,
  fadeThrough,
  focusBlurResolve,
  kineticCenterBuild,
  lineByLineSlide,
  maskRevealUp,
  microScaleFade,
  perCharacterRise,
  perWordCrossfade,
  scaleDownFade,
  sharedAxisX,
  sharedAxisY,
  sharedAxisZ,
  shimmerSweep,
  shortSlideDown,
  shortSlideRight,
  softBlurIn,
  springScaleIn,
  staggerFromCenter,
  staggerFromEdges,
  topDownLetters,
  typewriter,
];

/**
 * Pixel Point's `website-default` runtime preset; every showcase effect plays through it. Scaled durations
 * never drop below 140 ms (staggers may), as the exact recipes' `timing` blocks show.
 */
export const SHOWCASE_RUNTIME = { speedMultiplier: 0.72, yTravelMultiplier: 0.58, minDurationMs: 140 };

const scaleStagger = (value: number): number => Math.round(value * SHOWCASE_RUNTIME.speedMultiplier);
const scaleMs = (value: number): number => Math.max(SHOWCASE_RUNTIME.minDurationMs, scaleStagger(value));

function resolvePhase(phase: TextEffectSpec["enter"]): TextEffectPhase {
  return {
    durationMs: scaleMs(phase.duration_ms),
    staggerMs: scaleStagger(phase.stagger_ms),
    easing: phase.easing,
    from: phase.from,
    to: phase.to,
  };
}

function requireBuild<Key extends keyof TextEffectBuild>(
  spec: TextEffectSpec,
  key: Key
): NonNullable<TextEffectBuild[Key]> {
  const value = spec.build?.[key];
  if (value === undefined || value === null) throw new Error(`Text effect ${spec.id} needs build.${key}`);
  return value;
}

function resolveKineticBuild(spec: TextEffectSpec, axis: "x" | "y"): KineticBuild {
  return {
    firstWordMs: scaleMs(requireBuild(spec, "first_word_duration_ms")),
    pushMs: scaleMs(requireBuild(spec, "push_duration_ms")),
    exitMs: scaleMs(spec.build?.exit_duration_ms ?? spec.exit.duration_ms),
    entryOffsetPx: requireBuild(spec, axis === "x" ? "entry_offset_px" : "entry_offset_y_px"),
    gapPx: requireBuild(spec, axis === "x" ? "word_gap_px" : "line_gap_px"),
    firstWordYPx: requireBuild(spec, "first_word_y_px"),
    entryScale: requireBuild(spec, "entry_scale"),
    entryBlurPx: requireBuild(spec, "entry_blur_px"),
    reflowBlurPx: requireBuild(spec, "reflow_blur_px"),
    exitYPx: requireBuild(spec, "exit_y_px"),
    exitBlurPx: requireBuild(spec, "exit_blur_px"),
    easing: requireBuild(spec, "easing"),
    exitEasing: requireBuild(spec, "exit_easing"),
  };
}

function resolveRenderer(spec: TextEffectSpec, id: TextEffectRendererId): TextEffectRenderer {
  switch (id) {
    case "generic-stagger":
      return { id };
    case "shared-slide-opacity-stage":
      return {
        id,
        wordOpacity: {
          durationMs: scaleMs(requireBuild(spec, "word_opacity_duration_ms")),
          from: requireBuild(spec, "word_opacity_from"),
          to: requireBuild(spec, "word_opacity_to"),
        },
      };
    case "kinetic-center-build":
      return { id, build: resolveKineticBuild(spec, "x") };
    case "kinetic-top-build":
      return { id, build: resolveKineticBuild(spec, "y") };
  }
}

/** Validates every spec and resolves it the way the showcase plays it; throws on a malformed catalogue. */
export function loadTextEffects(rawSpecs: readonly unknown[], rawCatalog: unknown): TextEffect[] {
  const parsedCatalog = textEffectCatalogSchema.parse(rawCatalog);
  const effects = rawSpecs.map((raw) => {
    const spec = textEffectSpecSchema.parse(raw);
    const rendererId = parsedCatalog.renderer_overrides[spec.id] ?? spec.custom_renderer ?? "generic-stagger";
    const renderer = resolveRenderer(spec, rendererId);
    const effect: TextEffect = {
      id: spec.id,
      displayName: spec.display_name,
      description: spec.description,
      usageNotes: spec.usage_notes,
      target: spec.target,
      staggerMode: spec.stagger_mode ?? "normal",
      visible: parsedCatalog.visible_ids.includes(spec.id),
      enter: resolvePhase(spec.enter),
      exit: resolvePhase(spec.exit),
      yTravelMultiplier: renderer.id.startsWith("kinetic") ? 1 : SHOWCASE_RUNTIME.yTravelMultiplier,
      renderer,
    };
    return effect;
  });
  const ids = new Set(effects.map((effect) => effect.id));
  if (ids.size !== effects.length) throw new Error("Text effect ids must be unique");
  for (const id of parsedCatalog.visible_ids) {
    if (!ids.has(id)) throw new Error(`Catalogue lists unknown text effect ${id}`);
  }
  const order = (effect: TextEffect): number => {
    const index = parsedCatalog.visible_ids.indexOf(effect.id);
    return index === -1 ? parsedCatalog.visible_ids.length : index;
  };
  return effects.sort((a, b) => order(a) - order(b) || a.id.localeCompare(b.id));
}

let effects: TextEffect[] | undefined;

/** Every catalogue effect: the showcase order first, then the hidden ones alphabetically. */
export function listTextEffects(): readonly TextEffect[] {
  effects ??= loadTextEffects(RAW_TEXT_EFFECT_SPECS, catalog);
  return effects;
}

export function getTextEffect(id: string): TextEffect | undefined {
  return listTextEffects().find((effect) => effect.id === id);
}
