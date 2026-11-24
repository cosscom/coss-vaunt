import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import {
  AI_PROVIDERS,
  type AiProvider,
  type AiSettingsView,
  API_KEY_ENV,
  DEFAULT_MODELS,
} from "./ai-providers";

const apiKey = z.string().trim().min(1).max(500);

export const aiSettingsSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  /** Empty uses the provider's default model. */
  model: z.string().trim().max(120).optional(),
  apiKeys: z.partialRecord(z.enum(AI_PROVIDERS), apiKey),
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;

/** What the settings dialog sends: an absent key keeps the saved one, null removes it. */
export const aiSettingsUpdateSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  model: z.string().trim().max(120).optional(),
  apiKey: apiKey.nullable().optional(),
});
export type AiSettingsUpdate = z.infer<typeof aiSettingsUpdateSchema>;

export type ResolvedAi = { provider: AiProvider; model: string; apiKey: string };

type Env = Record<string, string | undefined>;

/** `$XDG_CONFIG_HOME/coss-vaunt/settings.json`, shared by every project on this machine. */
export function aiSettingsFile(env: Env = process.env): string {
  const configHome = env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(configHome, "coss-vaunt", "settings.json");
}

/** The saved settings, or null when there are none yet; a damaged file throws rather than silently dropping keys. */
export async function readAiSettings(file = aiSettingsFile()): Promise<AiSettings | null> {
  let content: string;
  try {
    content = await readFile(file, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
  return aiSettingsSchema.parse(JSON.parse(content));
}

export async function writeAiSettings(settings: AiSettings, file = aiSettingsFile()): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const partial = `${file}.${process.pid}.tmp`;
  await writeFile(partial, `${JSON.stringify(aiSettingsSchema.parse(settings), null, 2)}\n`, { mode: 0o600 });
  await rename(partial, file);
  await chmod(file, 0o600);
}

export function applyAiSettingsUpdate(saved: AiSettings | null, update: AiSettingsUpdate): AiSettings {
  const apiKeys = { ...saved?.apiKeys };
  if (update.apiKey === null) delete apiKeys[update.provider];
  else if (update.apiKey) apiKeys[update.provider] = update.apiKey;
  return { provider: update.provider, model: update.model || undefined, apiKeys };
}

function keyFor(provider: AiProvider, saved: AiSettings | null, env: Env): string | null {
  return env[API_KEY_ENV[provider]] || saved?.apiKeys[provider] || null;
}

/** Without saved settings, the AI Gateway reaches every provider, so its key wins over a provider's own. */
const ENV_PREFERENCE: readonly AiProvider[] = ["gateway", "anthropic", "openai"];

/** Without saved settings, the first provider with a key in the environment. */
function chosenProvider(saved: AiSettings | null, env: Env): AiProvider {
  if (saved) return saved.provider;
  return ENV_PREFERENCE.find((provider) => env[API_KEY_ENV[provider]]) ?? "anthropic";
}

/** The provider, model and key to call; an environment variable wins over a saved key. Null when there's no key. */
export function resolveAi(saved: AiSettings | null, env: Env = process.env): ResolvedAi | null {
  const provider = chosenProvider(saved, env);
  const key = keyFor(provider, saved, env);
  if (!key) return null;
  return { provider, model: saved?.model || DEFAULT_MODELS[provider], apiKey: key };
}

function keySource(provider: AiProvider, saved: AiSettings | null, env: Env): "env" | "saved" | null {
  if (env[API_KEY_ENV[provider]]) return "env";
  return saved?.apiKeys[provider] ? "saved" : null;
}

export function aiSettingsView(saved: AiSettings | null, env: Env = process.env): AiSettingsView {
  const provider = chosenProvider(saved, env);
  const keys = Object.fromEntries(
    AI_PROVIDERS.map((candidate) => [candidate, keySource(candidate, saved, env)])
  ) as AiSettingsView["keys"];
  return {
    provider,
    model: saved?.model ?? "",
    defaultModel: DEFAULT_MODELS[provider],
    keys,
    file: aiSettingsFile(env),
  };
}
