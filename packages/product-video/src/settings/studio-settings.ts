import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { AI_PROVIDERS } from "../ai/ai-providers";
import { type Appearance, appearanceSchema, DEFAULT_APPEARANCE } from "./appearance";
import {
  DEFAULT_EDITOR_PREFERENCES,
  type EditorPreferences,
  editorPreferencesSchema,
} from "./editor-preferences";

export {
  type Appearance,
  appearanceSchema,
  DEFAULT_APPEARANCE,
  DEFAULT_EDITOR_PREFERENCES,
  type EditorPreferences,
  editorPreferencesSchema,
};

/**
 * The studio's settings, shared by every project on this machine: the AI connections and model, and how the desktop
 * window looks. One file, readable only by the user, since it holds API keys.
 */

const apiKey = z.string().trim().min(1).max(500);
/** An http(s) address, like a local model server's `http://localhost:11434/v1`. */
export const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => /^https?:\/\/[^\s]+$/.test(value), "Must start with http:// or https://");

export const aiSettingsSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  /** Empty uses the provider's default model. */
  model: z.string().trim().max(120).optional(),
  apiKeys: z.partialRecord(z.enum(AI_PROVIDERS), apiKey),
  /** The OpenAI-compatible server's base URL. */
  baseUrl: httpUrl.optional(),
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;

export const SETTINGS_VERSION = 2;

export const studioSettingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION),
  /** Absent until AI is set up. */
  ai: aiSettingsSchema.optional(),
  appearance: appearanceSchema.optional(),
  /** Absent until changed; optional, so a file without it still reads as version 2. */
  editor: editorPreferencesSchema.optional(),
});
export type StudioSettings = z.infer<typeof studioSettingsSchema>;

/**
 * The file as read, on any version. Version 1 was the AI settings alone, with no version field; it becomes the
 * `ai` section. Anything else that doesn't parse throws rather than silently dropping keys.
 */
export function migrateSettings(raw: unknown): StudioSettings {
  if (typeof raw === "object" && raw !== null && "version" in raw) return studioSettingsSchema.parse(raw);
  return { version: SETTINGS_VERSION, ai: aiSettingsSchema.parse(raw) };
}

type Env = Record<string, string | undefined>;

/** `$XDG_CONFIG_HOME/coss-vaunt/settings.json`. */
export function studioSettingsFile(env: Env = process.env): string {
  const configHome = env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(configHome, "coss-vaunt", "settings.json");
}

/** The saved settings, migrated to the current version; empty when there's no file yet. */
export async function readStudioSettings(file = studioSettingsFile()): Promise<StudioSettings> {
  let content: string;
  try {
    content = await readFile(file, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return { version: SETTINGS_VERSION };
    throw error;
  }
  return migrateSettings(JSON.parse(content));
}

export async function writeStudioSettings(
  settings: StudioSettings,
  file = studioSettingsFile()
): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const partial = `${file}.${process.pid}.tmp`;
  await writeFile(partial, `${JSON.stringify(studioSettingsSchema.parse(settings), null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(partial, file);
  await chmod(file, 0o600);
}

/** Reads, changes one part and writes back, so each part keeps the others it doesn't know about. */
export async function updateStudioSettings(
  change: (settings: StudioSettings) => StudioSettings,
  file = studioSettingsFile()
): Promise<StudioSettings> {
  const next = change(await readStudioSettings(file));
  await writeStudioSettings(next, file);
  return next;
}

export function appearanceOf(settings: StudioSettings): Appearance {
  return settings.appearance ?? DEFAULT_APPEARANCE;
}

export function editorPreferencesOf(settings: StudioSettings): EditorPreferences {
  return settings.editor ?? DEFAULT_EDITOR_PREFERENCES;
}
