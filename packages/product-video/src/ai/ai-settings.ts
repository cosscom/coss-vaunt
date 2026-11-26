import { z } from "zod";
import {
  type AiSettings,
  aiSettingsSchema,
  httpUrl,
  readStudioSettings,
  studioSettingsFile,
  updateStudioSettings,
} from "../settings/studio-settings";
import {
  AI_PROVIDERS,
  type AiConnection,
  type AiProvider,
  type AiSettingsView,
  API_KEY_ENV,
  DEFAULT_MODELS,
} from "./ai-providers";

export { type AiSettings, aiSettingsSchema };

const apiKey = z.string().trim().min(1).max(500);

/**
 * What Settings and the model pickers send. Every part is optional: an absent key keeps the saved one, null removes
 * it; an absent base URL keeps it, null removes it.
 */
export const aiSettingsUpdateSchema = z.object({
  provider: z.enum(AI_PROVIDERS).optional(),
  model: z.string().trim().max(120).optional(),
  keys: z.partialRecord(z.enum(AI_PROVIDERS), apiKey.nullable()).optional(),
  baseUrl: httpUrl.nullable().optional(),
});
export type AiSettingsUpdate = z.infer<typeof aiSettingsUpdateSchema>;

/** What Test connection sends. */
export const connectionTestRequestSchema = z.object({ provider: z.enum(AI_PROVIDERS) });

export type ResolvedAi = { provider: AiProvider; model: string; apiKey: string; baseUrl?: string };

type Env = Record<string, string | undefined>;

/** `$XDG_CONFIG_HOME/coss-vaunt/settings.json`, shared by every project on this machine. */
export const aiSettingsFile = studioSettingsFile;

/** The saved AI settings, or null when there are none yet; a damaged file throws rather than silently dropping keys. */
export async function readAiSettings(file = aiSettingsFile()): Promise<AiSettings | null> {
  return (await readStudioSettings(file)).ai ?? null;
}

/** Saves the AI settings, keeping the rest of the settings file as it is. */
export async function writeAiSettings(settings: AiSettings, file = aiSettingsFile()): Promise<void> {
  await updateStudioSettings((current) => ({ ...current, ai: aiSettingsSchema.parse(settings) }), file);
}

function keyFor(provider: AiProvider, saved: AiSettings | null, env: Env): string | null {
  return env[API_KEY_ENV[provider]] || saved?.apiKeys[provider] || null;
}

/** Whether a provider can be called: it has a key, or for the OpenAI-compatible server, an address. */
export function isConnected(provider: AiProvider, saved: AiSettings | null, env: Env = process.env): boolean {
  if (provider === "compatible") return Boolean(saved?.baseUrl);
  return keyFor(provider, saved, env) !== null;
}

/** Without saved settings, the AI Gateway and OpenRouter reach every provider, so their keys win over a provider's own. */
const ENV_PREFERENCE: readonly AiProvider[] = [
  "gateway",
  "openrouter",
  "anthropic",
  "openai",
  "google",
  "xai",
  "mistral",
  "groq",
];

/** Without saved settings, the first provider with a key in the environment. */
function chosenProvider(saved: AiSettings | null, env: Env): AiProvider {
  if (saved) return saved.provider;
  return ENV_PREFERENCE.find((provider) => env[API_KEY_ENV[provider]]) ?? "anthropic";
}

/**
 * How to call one provider: its key (the environment's first), the model (the saved one when it's the chosen
 * provider, else its default) and, for the compatible server, its address. Null when it isn't connected or has no
 * model to call.
 */
export function resolveProvider(
  provider: AiProvider,
  saved: AiSettings | null,
  env: Env = process.env
): ResolvedAi | null {
  if (!isConnected(provider, saved, env)) return null;
  const chosen = chosenProvider(saved, env) === provider;
  const model = (chosen && saved?.model) || DEFAULT_MODELS[provider];
  if (!model) return null;
  const apiKey = keyFor(provider, saved, env) ?? "";
  return provider === "compatible"
    ? { provider, model, apiKey, baseUrl: saved?.baseUrl }
    : { provider, model, apiKey };
}

/** The provider, model and key to call; an environment variable wins over a saved key. Null when there's no key. */
export function resolveAi(saved: AiSettings | null, env: Env = process.env): ResolvedAi | null {
  return resolveProvider(chosenProvider(saved, env), saved, env);
}

/**
 * Applies what Settings sent. Adding the first connection while the chosen provider can't be called makes the new
 * one the chosen provider, so a fresh install works as soon as one key is in. Switching provider without naming a
 * model goes back to that provider's default.
 */
export function applyAiSettingsUpdate(
  saved: AiSettings | null,
  update: AiSettingsUpdate,
  env: Env = process.env
): AiSettings {
  const apiKeys = { ...saved?.apiKeys };
  for (const [provider, key] of Object.entries(update.keys ?? {}) as [AiProvider, string | null][]) {
    if (key === null) delete apiKeys[provider];
    else apiKeys[provider] = key;
  }
  let baseUrl = saved?.baseUrl;
  if (update.baseUrl === null) baseUrl = undefined;
  else if (update.baseUrl !== undefined) baseUrl = update.baseUrl;

  const current = chosenProvider(saved, env);
  const next: AiSettings = {
    provider: current,
    model: saved?.model,
    apiKeys,
    ...(baseUrl ? { baseUrl } : {}),
  };
  let provider = update.provider ?? current;
  if (!update.provider && !isConnected(current, saved, env)) {
    const added = [
      ...Object.keys(update.keys ?? {}),
      ...(update.baseUrl ? ["compatible"] : []),
    ] as AiProvider[];
    provider = added.find((candidate) => isConnected(candidate, next, env)) ?? current;
  }
  let model = saved?.model;
  if (update.model !== undefined) model = update.model || undefined;
  else if (provider !== current) model = undefined;
  return { ...next, provider, model };
}

/** The last four characters, enough to tell keys apart; nothing for a key too short to hide the rest. */
export function keyHint(key: string): string {
  return key.length >= 12 ? `…${key.slice(-4)}` : "";
}

function connection(provider: AiProvider, saved: AiSettings | null, env: Env): AiConnection | null {
  if (!isConnected(provider, saved, env)) return null;
  const fromEnv = env[API_KEY_ENV[provider]];
  const key = fromEnv || saved?.apiKeys[provider] || "";
  return { source: fromEnv ? "env" : "saved", hint: keyHint(key) };
}

export function aiSettingsView(saved: AiSettings | null, env: Env = process.env): AiSettingsView {
  const provider = chosenProvider(saved, env);
  const connections = Object.fromEntries(
    AI_PROVIDERS.map((candidate) => [candidate, connection(candidate, saved, env)])
  ) as AiSettingsView["connections"];
  return {
    provider,
    model: saved?.model ?? "",
    defaultModel: DEFAULT_MODELS[provider],
    connections,
    baseUrl: saved?.baseUrl ?? "",
    file: aiSettingsFile(env),
  };
}
