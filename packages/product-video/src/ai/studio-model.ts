import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGateway, type LanguageModel } from "ai";
import { type ResolvedAi, readAiSettings, resolveAi } from "./ai-settings";

export type StudioModel = LanguageModel;

export class MissingApiKeyError extends Error {
  override name = "MissingApiKeyError";
  constructor() {
    super("Add an AI API key in Settings to plan and script scenes");
  }
}

export function modelFor({ provider, model, apiKey }: ResolvedAi): StudioModel {
  if (provider === "anthropic") return createAnthropic({ apiKey })(model);
  if (provider === "openai") return createOpenAI({ apiKey })(model);
  return createGateway({ apiKey })(model);
}

/** The model the saved settings and environment point at, read fresh so a key saved in Settings applies at once. */
export async function loadStudioModel(): Promise<StudioModel> {
  const resolved = resolveAi(await readAiSettings());
  if (!resolved) throw new MissingApiKeyError();
  return modelFor(resolved);
}
