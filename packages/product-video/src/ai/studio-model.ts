import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createXai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createGateway, generateText, type LanguageModel } from "ai";
import { type AiProvider, API_KEY_ENV } from "./ai-providers";
import { type ResolvedAi, readAiSettings, resolveAi, resolveProvider } from "./ai-settings";

export type StudioModel = LanguageModel;

export class MissingApiKeyError extends Error {
  override name = "MissingApiKeyError";
  constructor() {
    super("Add an AI API key in Settings to plan and script scenes");
  }
}

export function modelFor({ provider, model, apiKey, baseUrl }: ResolvedAi): StudioModel {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
    case "xai":
      return createXai({ apiKey })(model);
    case "mistral":
      return createMistral({ apiKey })(model);
    case "groq":
      return createGroq({ apiKey })(model);
    case "openrouter":
      return createOpenRouter({ apiKey })(model);
    case "gateway":
      return createGateway({ apiKey })(model);
    case "compatible":
      return createOpenAICompatible({
        name: "compatible",
        baseURL: baseUrl ?? "",
        apiKey: apiKey || undefined,
      })(model);
  }
}

/** The model the saved settings and environment point at, read fresh so a key saved in Settings applies at once. */
export async function loadStudioModel(): Promise<StudioModel> {
  const resolved = resolveAi(await readAiSettings());
  if (!resolved) throw new MissingApiKeyError();
  return modelFor(resolved);
}

export type ConnectionTest = { ok: true; models?: string[] } | { ok: false; error: string };

const TEST_TIMEOUT_MS = 20_000;

/** The compatible server's model list (`GET /models`), which also proves it's there. */
async function listCompatibleModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/models`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const body = (await response.json()) as { data?: { id?: unknown }[] };
  return (body.data ?? []).map((model) => model.id).filter((id): id is string => typeof id === "string");
}

/**
 * Checks a provider answers with the key it has: a one-word reply from its model (a few tokens), or for the
 * compatible server, its model list.
 */
export async function testAiConnection(provider: AiProvider): Promise<ConnectionTest> {
  const saved = await readAiSettings();
  try {
    if (provider === "compatible") {
      if (!saved?.baseUrl) return { ok: false, error: "Add the server's address first" };
      const apiKey = process.env[API_KEY_ENV.compatible] || saved.apiKeys.compatible || "";
      return { ok: true, models: await listCompatibleModels(saved.baseUrl, apiKey) };
    }
    const resolved = resolveProvider(provider, saved);
    if (!resolved) return { ok: false, error: "No key" };
    await generateText({
      model: modelFor(resolved),
      prompt: "Reply with the word ok.",
      maxOutputTokens: 16,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(TEST_TIMEOUT_MS),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
