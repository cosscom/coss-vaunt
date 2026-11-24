export const AI_PROVIDERS = ["anthropic", "openai", "gateway"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Planning boards and scripting recordings are structured work with tools, so each provider gets its strongest model. */
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-opus-5-5",
  openai: "gpt-5",
  gateway: "anthropic/claude-opus-5-5",
};

export const API_KEY_ENV: Record<AiProvider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gateway: "AI_GATEWAY_API_KEY",
};

/** What the settings dialog shows; keys never leave the server, only where each one comes from. */
export type AiSettingsView = {
  provider: AiProvider;
  model: string;
  defaultModel: string;
  keys: Record<AiProvider, "env" | "saved" | null>;
  file: string;
};
