import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import { createModelRegistry } from "@calcom/ai/model-registry";

/** Drafting boards and scripting recordings are structured planning with tools, so they get the strongest Claude. */
export const STUDIO_MODEL_ID = "claude-opus-5-5";

export const studioModel = createModelRegistry<"plan">({
  envPrefix: "STUDIO_AI",
  defaults: { plan: STUDIO_MODEL_ID },
});

export type StudioModel = ReturnType<typeof studioModel>;

const AI_KEY_NAMES = ["AI_GATEWAY_API_KEY", "ANTHROPIC_API_KEY"] as const;

/** The studio runs from `apps/studio`, so the repo root `.env` isn't loaded; read only the AI keys from it. */
export async function loadAiKeys(repoRoot: string): Promise<void> {
  // biome-ignore lint/style/noProcessEnv: the AI SDK provider reads the key from the process environment
  const env = process.env;
  const content = await readFile(path.join(repoRoot, ".env"), "utf8").catch(() => "");
  const values: Record<string, unknown> = { ...parseEnv(content) };
  for (const name of AI_KEY_NAMES) {
    const value = values[name];
    if (!env[name] && typeof value === "string" && value) env[name] = value;
  }
}
