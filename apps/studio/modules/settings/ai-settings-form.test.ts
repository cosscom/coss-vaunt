import type { AiSettingsView } from "@calcom/product-video/ai/ai-providers";
import { describe, expect, it } from "vitest";
import { aiSettingsRequest, hasKeyAfterSave, initialAiSettingsForm } from "./ai-settings-form";

const view: AiSettingsView = {
  provider: "anthropic",
  model: "",
  defaultModel: "claude-opus-5-5",
  keys: { anthropic: "saved", openai: "env", gateway: null },
  file: "/home/demo/.config/coss-vaunt/settings.json",
};
const form = initialAiSettingsForm(view);

describe("aiSettingsRequest", () => {
  it("keeps the saved key unless a new one is typed or it is removed", () => {
    expect(aiSettingsRequest(form)).toEqual({ provider: "anthropic", model: "" });
    expect(aiSettingsRequest({ ...form, apiKey: "  sk-new " })).toEqual({
      provider: "anthropic",
      model: "",
      apiKey: "sk-new",
    });
    expect(aiSettingsRequest({ ...form, removeKey: true }).apiKey).toBeNull();
  });
});

describe("hasKeyAfterSave", () => {
  it("counts saved, typed and environment keys", () => {
    expect(hasKeyAfterSave(form, view)).toBe(true);
    expect(hasKeyAfterSave({ ...form, removeKey: true }, view)).toBe(false);
    expect(hasKeyAfterSave({ ...form, provider: "openai" }, view)).toBe(true);
    expect(hasKeyAfterSave({ ...form, provider: "gateway" }, view)).toBe(false);
    expect(hasKeyAfterSave({ ...form, provider: "gateway", apiKey: "gw" }, view)).toBe(true);
  });
});
