import type { AiProvider, AiSettingsView } from "@coss/vaunt-engine/ai/ai-providers";

export type AiSettingsForm = { provider: AiProvider; model: string; apiKey: string; removeKey: boolean };

export function initialAiSettingsForm(view: AiSettingsView): AiSettingsForm {
  return { provider: view.provider, model: view.model, apiKey: "", removeKey: false };
}

/** The PUT body: a blank key keeps the saved one, so the dialog never has to show it. */
export function aiSettingsRequest(form: AiSettingsForm): {
  provider: AiProvider;
  model: string;
  apiKey?: string | null;
} {
  const apiKey = form.apiKey.trim();
  const body = { provider: form.provider, model: form.model.trim() };
  if (apiKey) return { ...body, apiKey };
  return form.removeKey ? { ...body, apiKey: null } : body;
}

/** Whether saving would leave the chosen provider with a key to call. */
export function hasKeyAfterSave(form: AiSettingsForm, view: AiSettingsView): boolean {
  if (form.apiKey.trim()) return true;
  const source = view.keys[form.provider];
  return source === "env" || (source === "saved" && !form.removeKey);
}
