export const AI_PROVIDERS = ["anthropic", "openai", "gateway"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Planning boards and scripting recordings are structured work with tools, so each provider gets its strongest model. */
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-opus-5-5",
  openai: "gpt-5",
  gateway: "anthropic/claude-opus-5-5",
};

/** The models the composer's picker offers for each provider; Settings still takes any model id. */
export const MODEL_CHOICES: Record<AiProvider, readonly { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-opus-5-5", label: "Opus 5.5" },
    { id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
    { id: "claude-haiku-5-5", label: "Haiku 5.5" },
    { id: "claude-fable-5-2", label: "Fable 5.2" },
  ],
  openai: [
    { id: "gpt-5", label: "GPT-5" },
    { id: "gpt-5-mini", label: "GPT-5 mini" },
  ],
  gateway: [
    { id: "anthropic/claude-opus-5-5", label: "Opus 5.5" },
    { id: "anthropic/claude-sonnet-5-5", label: "Sonnet 5.5" },
    { id: "openai/gpt-5", label: "GPT-5" },
  ],
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
