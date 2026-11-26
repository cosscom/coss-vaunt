import {
  AI_PROVIDERS,
  type AiProvider,
  type AiSettingsView,
  MODEL_CHOICES,
} from "@coss/vaunt-engine/ai/ai-providers";

export type ModelOption = { id: string; label: string };
export type ModelGroup = { provider: AiProvider; models: ModelOption[] };

/** The model in use: the saved one, or the provider's default. */
export function activeModel(view: AiSettingsView): string {
  return view.model || view.defaultModel;
}

/** `provider:model`, a picker's value for a choice; model ids can hold colons of their own. */
export function choiceValue(provider: AiProvider, model: string): string {
  return `${provider}:${model}`;
}

export function parseChoice(value: string): { provider: AiProvider; model: string } | null {
  const at = value.indexOf(":");
  const provider = value.slice(0, at) as AiProvider;
  if (at < 0 || !AI_PROVIDERS.includes(provider)) return null;
  return { provider, model: value.slice(at + 1) };
}

/**
 * What the pickers list: each connected provider's models, plus the model in use when it isn't one of them (a model
 * id typed in Settings, or the local server's model). `extra` adds models found by testing a connection.
 */
export function modelGroups(
  view: AiSettingsView,
  extra: Partial<Record<AiProvider, readonly string[]>> = {}
): ModelGroup[] {
  return AI_PROVIDERS.filter((provider) => view.connections[provider] !== null).map((provider) => {
    const models: ModelOption[] = [...MODEL_CHOICES[provider]];
    const add = (id: string) => {
      if (id && !models.some((model) => model.id === id)) models.push({ id, label: id });
    };
    for (const id of extra[provider] ?? []) add(id);
    if (provider === view.provider) add(activeModel(view));
    return { provider, models };
  });
}

/** The label for the model in use, as the pickers show it. */
export function activeModelLabel(view: AiSettingsView): string {
  const id = activeModel(view);
  return MODEL_CHOICES[view.provider].find((choice) => choice.id === id)?.label ?? id;
}

/** The PUT body that saves (or, with null, removes) one provider's key; the key is trimmed. */
export function keyUpdate(
  provider: AiProvider,
  key: string | null
): { keys: Partial<Record<AiProvider, string | null>> } {
  return { keys: { [provider]: key === null ? null : key.trim() } };
}

/** Whether a typed base URL is one the server will take. */
export function isHttpUrl(value: string): boolean {
  return /^https?:\/\/[^\s]+$/.test(value.trim());
}
