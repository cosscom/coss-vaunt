import { z } from "zod";
import { parseCssEasing } from "../../text/css-easing";

export const TEXT_EFFECT_TARGETS = ["whole", "per-character", "per-word", "per-line"] as const;
export const STAGGER_MODES = ["normal", "center-out", "edges-in", "reverse"] as const;
export const TEXT_EFFECT_RENDERERS = [
  "generic-stagger",
  "shared-slide-opacity-stage",
  "kinetic-center-build",
  "kinetic-top-build",
] as const;

const easingSchema = z.string().refine((value) => parseCssEasing(value) !== null, "Unsupported CSS easing");
const ms = z.number().min(0);

/** Strict, so a spec using a frame key the evaluator doesn't animate fails validation instead of being ignored. */
export const textFrameSchema = z
  .object({
    opacity: z.number().min(0).max(1),
    x_px: z.number(),
    y_px: z.number(),
    z_px: z.number(),
    scale: z.number(),
    rotate_deg: z.number(),
    rotate_x_deg: z.number(),
    rotate_y_deg: z.number(),
    blur_px: z.number().min(0),
  })
  .partial()
  .strict();

const phaseSchema = z.object({
  duration_ms: ms,
  stagger_ms: ms,
  easing: easingSchema,
  from: textFrameSchema,
  to: textFrameSchema,
});

const buildSchema = z
  .object({
    first_word_duration_ms: ms,
    push_duration_ms: ms,
    exit_duration_ms: ms,
    entry_offset_px: z.number(),
    entry_offset_y_px: z.number(),
    word_gap_px: z.number(),
    line_gap_px: z.number(),
    first_word_y_px: z.number(),
    entry_scale: z.number(),
    entry_blur_px: z.number().min(0),
    reflow_blur_px: z.number().min(0),
    exit_y_px: z.number(),
    exit_blur_px: z.number().min(0),
    easing: easingSchema,
    exit_easing: easingSchema,
    word_opacity_duration_ms: ms,
    word_opacity_from: z.number().min(0).max(1),
    word_opacity_to: z.number().min(0).max(1),
  })
  .partial();

/** The portable motion contract in `specs/<id>.json`. */
export const textEffectSpecSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  display_name: z.string().min(1),
  description: z.string().min(1),
  usage_notes: z.string(),
  target: z.enum(TEXT_EFFECT_TARGETS),
  signature_easing: easingSchema,
  stagger_mode: z.enum(STAGGER_MODES).optional(),
  custom_renderer: z.enum(TEXT_EFFECT_RENDERERS).optional(),
  enter: phaseSchema,
  exit: phaseSchema,
  build: buildSchema.optional(),
});

/** `catalog.json`: the showcase order and the renderer the showcase swaps in for some specs. */
export const textEffectCatalogSchema = z.object({
  visible_ids: z.array(z.string()),
  renderer_overrides: z.record(z.string(), z.enum(TEXT_EFFECT_RENDERERS)),
});

export type TextEffectTarget = (typeof TEXT_EFFECT_TARGETS)[number];
export type StaggerMode = (typeof STAGGER_MODES)[number];
export type TextEffectRendererId = (typeof TEXT_EFFECT_RENDERERS)[number];
export type TextFrame = z.infer<typeof textFrameSchema>;
export type TextEffectSpec = z.infer<typeof textEffectSpecSchema>;
export type TextEffectBuild = NonNullable<TextEffectSpec["build"]>;
