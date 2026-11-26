import type { AiSettingsView } from "@coss/vaunt-engine/ai/ai-providers";
import { describe, expect, it } from "vitest";
import {
  activeModel,
  activeModelLabel,
  choiceValue,
  isHttpUrl,
  keyUpdate,
  modelGroups,
  parseChoice,
} from "./ai-connections";

const none = {
  anthropic: null,
  openai: null,
  google: null,
  xai: null,
  mistral: null,
  groq: null,
  openrouter: null,
  gateway: null,
  compatible: null,
};
const view: AiSettingsView = {
  provider: "anthropic",
  model: "",
  defaultModel: "claude-opus-5-5",
  connections: { ...none, anthropic: { source: "saved", hint: "…abcd" }, groq: { source: "env", hint: "" } },
  baseUrl: "",
  file: "/home/demo/.config/coss-vaunt/settings.json",
};

describe("modelGroups", () => {
  it("lists the models of connected providers only, in provider order", () => {
    const groups = modelGroups(view);
    expect(groups.map((group) => group.provider)).toEqual(["anthropic", "groq"]);
    expect(groups[0]?.models[0]).toEqual({ id: "claude-opus-5-5", label: "Opus 5.5" });
    expect(modelGroups({ ...view, connections: none })).toEqual([]);
  });

  it("adds the model in use when it isn't a listed one, and models a test found", () => {
    const local: AiSettingsView = {
      ...view,
      provider: "compatible",
      model: "llama3.2",
      defaultModel: "",
      connections: { ...none, compatible: { source: "saved", hint: "" } },
      baseUrl: "http://localhost:11434/v1",
    };
    expect(modelGroups(local)).toEqual([
      { provider: "compatible", models: [{ id: "llama3.2", label: "llama3.2" }] },
    ]);
    expect(
      modelGroups(local, { compatible: ["qwen3", "llama3.2"] })[0]?.models.map((model) => model.id)
    ).toEqual(["qwen3", "llama3.2"]);
    const typed = modelGroups({ ...view, model: "claude-opus-5-5-20261101" })[0]?.models;
    expect(typed?.at(-1)).toEqual({ id: "claude-opus-5-5-20261101", label: "claude-opus-5-5-20261101" });
  });
});

describe("choices", () => {
  it("round-trip model ids with colons in them", () => {
    expect(parseChoice(choiceValue("openrouter", "meta/llama:free"))).toEqual({
      provider: "openrouter",
      model: "meta/llama:free",
    });
    expect(parseChoice("nobody:model")).toBeNull();
    expect(parseChoice("no-colon")).toBeNull();
  });

  it("label the model in use, falling back to its id", () => {
    expect(activeModel(view)).toBe("claude-opus-5-5");
    expect(activeModelLabel(view)).toBe("Opus 5.5");
    expect(activeModelLabel({ ...view, model: "claude-x" })).toBe("claude-x");
  });
});

describe("keyUpdate", () => {
  it("trims a key, and removes one with null", () => {
    expect(keyUpdate("xai", "  xai-key \n")).toEqual({ keys: { xai: "xai-key" } });
    expect(keyUpdate("xai", null)).toEqual({ keys: { xai: null } });
  });
});

describe("isHttpUrl", () => {
  it("takes http and https addresses only", () => {
    expect(isHttpUrl("http://localhost:11434/v1")).toBe(true);
    expect(isHttpUrl(" https://api.example.com/v1 ")).toBe(true);
    expect(isHttpUrl("localhost:11434")).toBe(false);
    expect(isHttpUrl("file:///etc/passwd")).toBe(false);
  });
});
