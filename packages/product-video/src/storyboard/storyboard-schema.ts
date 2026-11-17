import { z } from "zod";
import { PROPERTY_KEYS, PROPERTY_SPECS, type PropertyKey } from "./property-specs";

const id = z.string().min(1);
const seconds = z.number().min(0);

/** Recorded clips are short so a frame-stepped recording stays a few minutes of work. */
export const MAX_RECORDING_SECONDS = 8;
export const MAX_CLIP_SECONDS = 60;
export const MAX_TRANSITION_SECONDS = 2;
export const DEFAULT_IMAGE_CLIP_SECONDS = 3;

export const ASPECT_RATIOS = ["9:16", "4:5", "1:1", "16:9"] as const;
export const VIDEO_THEMES = ["light", "dark"] as const;
export const TRANSITION_KINDS = ["cut", "crossfade", "cross-blur", "zoom-through", "slide"] as const;
export const EASES = ["linear", "ease-in", "ease-out", "ease-in-out", "hold"] as const;
export const TEXT_SIZES = ["display", "title", "body"] as const;
export const TEXT_ALIGNS = ["start", "center", "end"] as const;

export const aspectRatioSchema = z.enum(ASPECT_RATIOS);

export const actionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("move"), at: seconds, target: z.string().min(1) }),
  z.object({ kind: z.literal("click"), at: seconds, target: z.string().min(1) }),
  z.object({ kind: z.literal("type"), at: seconds, target: z.string().min(1), text: z.string() }),
  z.object({ kind: z.literal("press"), at: seconds, key: z.string().min(1) }),
]);

export const keyframeSchema = z.object({
  id,
  /** Seconds from the start of the clip. */
  at: seconds,
  value: z.number(),
  /** Easing of the segment that ends at this keyframe. */
  ease: z.enum(EASES),
});

export const animatedPropertySchema = z.object({
  /** Used when the property has no keyframes. */
  value: z.number(),
  keyframes: z.array(keyframeSchema),
});

const clipPropertiesSchema = z.partialRecord(z.enum(PROPERTY_KEYS), animatedPropertySchema);

export const clipSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("recording"),
    route: z.string().startsWith("/"),
    actions: z.array(actionSchema),
  }),
  z.object({
    kind: z.literal("import"),
    /** Path relative to the project folder, e.g. `imports/<file>.mp4`. */
    file: z.string().min(1),
    /** Seconds into the file where the clip starts. */
    trimStart: seconds,
    /** Length of the whole file, so trims can be bounded. */
    fileDuration: z.number().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("image"),
    /** Path relative to the project folder, e.g. `imports/<file>.png`. */
    file: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("text"),
    text: z.string().trim().min(1).max(200),
    /** Ids from the animate-text catalogue. */
    effectIn: z.string().min(1).optional(),
    effectOut: z.string().min(1).optional(),
    size: z.enum(TEXT_SIZES),
    align: z.enum(TEXT_ALIGNS),
    weight: z.number().int().min(300).max(800),
  }),
]);

export const clipSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(80),
    /** Seconds from the start of the video. */
    start: seconds,
    duration: z.number().positive().max(MAX_CLIP_SECONDS),
    /** Played over the overlap with the previous clip on the same track; ignored without an overlap. */
    transitionIn: z.enum(TRANSITION_KINDS),
    properties: clipPropertiesSchema,
    /** CSS selector inside a recording that depth of field focuses on. */
    focus: z.string().min(1).optional(),
    source: clipSourceSchema,
  })
  .superRefine((clip, ctx) => {
    if (clip.source.kind === "recording" && clip.duration > MAX_RECORDING_SECONDS) {
      ctx.addIssue({
        code: "custom",
        path: ["duration"],
        message: `Recorded clips are at most ${MAX_RECORDING_SECONDS} seconds`,
      });
    }
    if (
      clip.source.kind === "import" &&
      clip.source.trimStart + clip.duration > clip.source.fileDuration + 1e-6
    ) {
      ctx.addIssue({ code: "custom", path: ["duration"], message: "Clip runs past the end of the file" });
    }
    for (const [key, property] of Object.entries(clip.properties) as Array<[PropertyKey, AnimatedProperty]>) {
      const spec = PROPERTY_SPECS[key];
      for (const [index, value] of [property.value, ...property.keyframes.map((k) => k.value)].entries()) {
        if (value < spec.min || value > spec.max) {
          ctx.addIssue({
            code: "custom",
            path: ["properties", key, index === 0 ? "value" : `keyframes.${index - 1}`],
            message: `${spec.label} must be between ${spec.min} and ${spec.max}`,
          });
        }
      }
      property.keyframes.forEach((keyframe, index) => {
        if (keyframe.at > clip.duration + 1e-6) {
          ctx.addIssue({
            code: "custom",
            path: ["properties", key, "keyframes", index, "at"],
            message: "Keyframe is after the clip ends",
          });
        }
      });
    }
    if (clip.source.kind !== "recording") return;
    clip.source.actions.forEach((action, index) => {
      if (action.at > clip.duration + 1e-6) {
        ctx.addIssue({
          code: "custom",
          path: ["source", "actions", index, "at"],
          message: "Action is after the clip ends",
        });
      }
    });
  });

export const videoTrackSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(40),
    clips: z.array(clipSchema),
    /** Hidden tracks stay in the project but don't draw. */
    hidden: z.boolean().optional(),
  })
  .superRefine((track, ctx) => {
    const clips = [...track.clips].sort((a, b) => a.start - b.start);
    for (let index = 1; index < clips.length; index++) {
      const previous = clips[index - 1];
      const clip = clips[index];
      const overlap = previous.start + previous.duration - clip.start;
      if (overlap <= 1e-6) continue;
      const path = ["clips", track.clips.indexOf(clip), "start"];
      if (overlap > MAX_TRANSITION_SECONDS + 1e-6) {
        ctx.addIssue({
          code: "custom",
          path,
          message: `Overlap is at most ${MAX_TRANSITION_SECONDS} seconds`,
        });
      }
      if (overlap >= Math.min(previous.duration, clip.duration) - 1e-6) {
        ctx.addIssue({ code: "custom", path, message: "A clip can't cover another clip completely" });
      }
      const beforePrevious = clips[index - 2];
      if (beforePrevious && beforePrevious.start + beforePrevious.duration > clip.start + 1e-6) {
        ctx.addIssue({ code: "custom", path, message: "A clip can overlap only the clip before it" });
      }
    }
  });

export const MAX_AUDIO_FADE_SECONDS = 5;

const fadeSeconds = z.number().min(0).max(MAX_AUDIO_FADE_SECONDS);

export const audioClipSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(80),
    /** Path relative to the project folder, e.g. `imports/<file>.mp3`; its peaks are at `<file>.peaks.json`. */
    file: z.string().min(1),
    /** Music ducks under sound effects while they play. */
    kind: z.enum(["music", "sfx"]),
    start: seconds,
    duration: z.number().positive(),
    /** Seconds into the file where the clip starts. */
    trimStart: seconds,
    fileDuration: z.number().positive(),
    /** Gain 0..1; keyframe times are seconds from the start of the clip. */
    volume: animatedPropertySchema,
    fadeIn: fadeSeconds,
    fadeOut: fadeSeconds,
  })
  .superRefine((clip, ctx) => {
    if (clip.trimStart + clip.duration > clip.fileDuration + 1e-6) {
      ctx.addIssue({ code: "custom", path: ["duration"], message: "Clip runs past the end of the file" });
    }
    if (clip.fadeIn + clip.fadeOut > clip.duration + 1e-6) {
      ctx.addIssue({ code: "custom", path: ["fadeOut"], message: "Fades are longer than the clip" });
    }
    for (const [index, value] of [
      clip.volume.value,
      ...clip.volume.keyframes.map((k) => k.value),
    ].entries()) {
      if (value < 0 || value > 1) {
        ctx.addIssue({
          code: "custom",
          path: ["volume", index === 0 ? "value" : `keyframes.${index - 1}`],
          message: "Volume must be between 0 and 1",
        });
      }
    }
    clip.volume.keyframes.forEach((keyframe, index) => {
      if (keyframe.at > clip.duration + 1e-6) {
        ctx.addIssue({
          code: "custom",
          path: ["volume", "keyframes", index, "at"],
          message: "Keyframe is after the clip ends",
        });
      }
    });
  });

export const audioTrackSchema = z.object({
  id,
  name: z.string().trim().min(1).max(40),
  clips: z.array(audioClipSchema),
  /** Muted tracks stay in the project but don't play. */
  muted: z.boolean().optional(),
});

export const projectSettingsSchema = z.object({
  aspectRatio: aspectRatioSchema,
  theme: z.enum(VIDEO_THEMES),
  fps: z.union([z.literal(30), z.literal(60)]),
  background: z.object({ kind: z.enum(["color", "gradient"]), value: z.string().min(1) }),
  device: z.object({
    cornerRadius: z.number().min(0).max(64),
    contactShadow: z.boolean(),
    plinth: z.boolean(),
    reflection: z.number().min(0).max(1),
  }),
  baseUrl: z.url(),
});

export const projectSchema = z.object({
  version: z.literal(2),
  id,
  name: z.string().trim().min(1).max(120),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  settings: projectSettingsSchema,
  /** Index 0 is the bottom track; later tracks draw over earlier ones. */
  videoTracks: z.array(videoTrackSchema).min(1),
  audioTracks: z.array(audioTrackSchema),
});

export type AspectRatio = z.infer<typeof aspectRatioSchema>;
export type Action = z.infer<typeof actionSchema>;
export type Ease = (typeof EASES)[number];
export type Keyframe = z.infer<typeof keyframeSchema>;
export type AnimatedProperty = z.infer<typeof animatedPropertySchema>;
export type ClipSource = z.infer<typeof clipSourceSchema>;
export type Clip = z.infer<typeof clipSchema>;
export type TransitionKind = (typeof TRANSITION_KINDS)[number];
export type VideoTrack = z.infer<typeof videoTrackSchema>;
export type AudioClip = z.infer<typeof audioClipSchema>;
export type AudioTrack = z.infer<typeof audioTrackSchema>;
export type ProjectSettings = z.infer<typeof projectSettingsSchema>;
export type Project = z.infer<typeof projectSchema>;
