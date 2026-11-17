import type { StaggerMode, TextEffectTarget, TextFrame } from "./text-effect-schema";

/** One phase with the showcase runtime applied: durations and staggers already scaled by its speed. */
export type TextEffectPhase = {
  durationMs: number;
  staggerMs: number;
  easing: string;
  from: TextFrame;
  to: TextFrame;
};

/** Layout-aware build: offsets are showcase pixels, scaled to the frame by the evaluator. */
export type KineticBuild = {
  firstWordMs: number;
  pushMs: number;
  exitMs: number;
  /** Along x for the centre build, along y for the top build. */
  entryOffsetPx: number;
  gapPx: number;
  firstWordYPx: number;
  entryScale: number;
  entryBlurPx: number;
  reflowBlurPx: number;
  exitYPx: number;
  exitBlurPx: number;
  easing: string;
  exitEasing: string;
};

export type TextEffectRenderer =
  | { id: "generic-stagger" }
  | { id: "shared-slide-opacity-stage"; wordOpacity: { durationMs: number; from: number; to: number } }
  | { id: "kinetic-center-build" | "kinetic-top-build"; build: KineticBuild };

/** A catalogue entry resolved for playback. */
export type TextEffect = {
  id: string;
  displayName: string;
  description: string;
  usageNotes: string;
  target: TextEffectTarget;
  staggerMode: StaggerMode;
  /** Shown on Pixel Point's site; the hidden four have no exact showcase recipe. */
  visible: boolean;
  enter: TextEffectPhase;
  exit: TextEffectPhase;
  /** Applied to `y_px` of generic frames; kinetic builds use raw pixels. */
  yTravelMultiplier: number;
  renderer: TextEffectRenderer;
};
