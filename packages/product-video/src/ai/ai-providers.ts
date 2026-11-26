/**
 * The AI providers the studio can call, each through its AI SDK provider package. `compatible` is any server that
 * speaks the OpenAI API at a base URL, like Ollama or LM Studio on this machine; its key is optional.
 */
export const AI_PROVIDERS = [
  "anthropic",
  "openai",
  "google",
  "xai",
  "mistral",
  "groq",
  "openrouter",
  "gateway",
  "compatible",
] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Planning boards and scripting recordings are structured work with tools, so each provider gets its strongest model. */
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-opus-5-5",
  openai: "gpt-5",
  google: "gemini-3-pro-preview",
  xai: "grok-4",
  mistral: "mistral-large-latest",
  groq: "openai/gpt-oss-120b",
  openrouter: "anthropic/claude-opus-5.5",
  gateway: "anthropic/claude-opus-5-5",
  compatible: "",
};

/** The models the pickers offer for each provider; Settings still takes any model id. */
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
  google: [
    { id: "gemini-3-pro-preview", label: "Gemini 3 Pro" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  ],
  xai: [
    { id: "grok-4", label: "Grok 4" },
    { id: "grok-4-fast-reasoning", label: "Grok 4 Fast" },
  ],
  mistral: [
    { id: "mistral-large-latest", label: "Mistral Large" },
    { id: "mistral-medium-latest", label: "Mistral Medium" },
  ],
  groq: [
    { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
    { id: "moonshotai/kimi-k2-instruct", label: "Kimi K2" },
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
  ],
  openrouter: [
    { id: "anthropic/claude-opus-5.5", label: "Opus 5.5" },
    { id: "openai/gpt-5", label: "GPT-5" },
    { id: "google/gemini-3-pro-preview", label: "Gemini 3 Pro" },
  ],
  gateway: [
    { id: "anthropic/claude-opus-5-5", label: "Opus 5.5" },
    { id: "anthropic/claude-sonnet-5-5", label: "Sonnet 5.5" },
    { id: "openai/gpt-5", label: "GPT-5" },
  ],
  // Whatever the local server has pulled; the model is typed in Settings.
  compatible: [],
};

/** The environment variable each provider's key can come from; it wins over a saved key. */
export const API_KEY_ENV: Record<AiProvider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  xai: "XAI_API_KEY",
  mistral: "MISTRAL_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  gateway: "AI_GATEWAY_API_KEY",
  compatible: "OPENAI_COMPATIBLE_API_KEY",
};

/** Ollama's address; LM Studio serves on http://localhost:1234/v1. */
export const DEFAULT_COMPATIBLE_BASE_URL = "http://localhost:11434/v1";

/** How a provider is connected: where its key comes from and its last four characters, never the key itself. */
export type AiConnection = { source: "env" | "saved"; hint: string };

/** What Settings shows; keys never leave the server, only where each one comes from. */
export type AiSettingsView = {
  provider: AiProvider;
  model: string;
  defaultModel: string;
  /** Null when the provider can't be called yet. `compatible` is connected once it has a base URL. */
  connections: Record<AiProvider, AiConnection | null>;
  /** The OpenAI-compatible server's base URL, empty when none is set. */
  baseUrl: string;
  file: string;
};
