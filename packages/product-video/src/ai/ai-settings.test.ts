import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type AiSettings,
  aiSettingsFile,
  aiSettingsView,
  applyAiSettingsUpdate,
  readAiSettings,
  resolveAi,
  resolveProvider,
  writeAiSettings,
} from "./ai-settings";

const saved: AiSettings = {
  provider: "openai",
  model: "",
  apiKeys: { openai: "sk-saved", anthropic: "sk-ant" },
};

describe("resolveAi", () => {
  it("uses the saved provider, its key and its default model", () => {
    expect(resolveAi(saved, {})).toEqual({ provider: "openai", model: "gpt-5", apiKey: "sk-saved" });
    expect(resolveAi({ ...saved, model: "gpt-5-mini" }, {})?.model).toBe("gpt-5-mini");
  });

  it("prefers the environment's key over the saved one", () => {
    expect(resolveAi(saved, { OPENAI_API_KEY: "sk-env" })?.apiKey).toBe("sk-env");
  });

  it("without settings, picks the first provider with a key in the environment", () => {
    expect(resolveAi(null, { AI_GATEWAY_API_KEY: "gw" })).toEqual({
      provider: "gateway",
      model: "anthropic/claude-opus-5-5",
      apiKey: "gw",
    });
    expect(resolveAi(null, { ANTHROPIC_API_KEY: "a", AI_GATEWAY_API_KEY: "gw" })?.provider).toBe("gateway");
    expect(resolveAi(null, { GROQ_API_KEY: "g", OPENROUTER_API_KEY: "or" })?.provider).toBe("openrouter");
    expect(resolveAi(null, { GOOGLE_GENERATIVE_AI_API_KEY: "g" })?.model).toBe("gemini-3-pro-preview");
    expect(resolveAi(null, {})).toBeNull();
    expect(resolveAi({ provider: "gateway", apiKeys: {} }, { ANTHROPIC_API_KEY: "x" })).toBeNull();
  });

  it("calls the OpenAI-compatible server by its address, with a model and no key needed", () => {
    const local: AiSettings = {
      provider: "compatible",
      model: "llama3.2",
      apiKeys: {},
      baseUrl: "http://localhost:11434/v1",
    };
    expect(resolveAi(local, {})).toEqual({
      provider: "compatible",
      model: "llama3.2",
      apiKey: "",
      baseUrl: "http://localhost:11434/v1",
    });
    // It has no default model, and nothing to call without an address.
    expect(resolveAi({ ...local, model: undefined }, {})).toBeNull();
    expect(resolveAi({ ...local, baseUrl: undefined }, {})).toBeNull();
  });
});

describe("resolveProvider", () => {
  it("uses the saved model only for the chosen provider", () => {
    const both: AiSettings = { ...saved, model: "gpt-5-mini" };
    expect(resolveProvider("anthropic", both, {})).toEqual({
      provider: "anthropic",
      model: "claude-opus-5-5",
      apiKey: "sk-ant",
    });
    expect(resolveProvider("openai", both, {})?.model).toBe("gpt-5-mini");
    expect(resolveProvider("mistral", both, {})).toBeNull();
    expect(resolveProvider("mistral", both, { MISTRAL_API_KEY: "m" })?.apiKey).toBe("m");
  });
});

describe("applyAiSettingsUpdate", () => {
  it("keeps a saved key when the update leaves it out, and removes it on null", () => {
    expect(applyAiSettingsUpdate(saved, { provider: "openai" }, {}).apiKeys.openai).toBe("sk-saved");
    expect(applyAiSettingsUpdate(saved, { keys: { openai: null } }, {}).apiKeys).toEqual({
      anthropic: "sk-ant",
    });
    expect(
      applyAiSettingsUpdate(null, { provider: "anthropic", keys: { anthropic: "new" }, model: "" }, {})
    ).toEqual({
      provider: "anthropic",
      model: undefined,
      apiKeys: { anthropic: "new" },
    });
  });

  it("adds a key without switching away from a provider that works", () => {
    const next = applyAiSettingsUpdate(saved, { keys: { google: "g-key" } }, {});
    expect(next.provider).toBe("openai");
    expect(next.apiKeys.google).toBe("g-key");
  });

  it("makes the first connection the chosen provider", () => {
    expect(applyAiSettingsUpdate(null, { keys: { xai: "x-key" } }, {}).provider).toBe("xai");
    expect(applyAiSettingsUpdate(null, { baseUrl: "http://localhost:1234/v1" }, {})).toEqual({
      provider: "compatible",
      model: undefined,
      apiKeys: {},
      baseUrl: "http://localhost:1234/v1",
    });
    // With a key in the environment, the environment's provider is already chosen and stays.
    expect(applyAiSettingsUpdate(null, { keys: { xai: "x" } }, { ANTHROPIC_API_KEY: "a" }).provider).toBe(
      "anthropic"
    );
  });

  it("goes back to the default model when switching provider without naming one", () => {
    const chosen = { ...saved, model: "gpt-5-mini" };
    expect(applyAiSettingsUpdate(chosen, { provider: "anthropic" }, {}).model).toBeUndefined();
    expect(applyAiSettingsUpdate(chosen, { provider: "openai" }, {}).model).toBe("gpt-5-mini");
    expect(
      applyAiSettingsUpdate(chosen, { provider: "anthropic", model: "claude-haiku-5-5" }, {}).model
    ).toBe("claude-haiku-5-5");
  });

  it("sets and removes the compatible server's address", () => {
    const local = applyAiSettingsUpdate(saved, { baseUrl: "http://localhost:11434/v1" }, {});
    expect(local.baseUrl).toBe("http://localhost:11434/v1");
    expect(applyAiSettingsUpdate(local, { baseUrl: null }, {})).not.toHaveProperty("baseUrl");
  });
});

describe("aiSettingsView", () => {
  it("says where each key comes from and its last characters, never the key", () => {
    const view = aiSettingsView(
      { ...saved, apiKeys: { ...saved.apiKeys, openai: "sk-proj-abcdefgh1234" } },
      { ANTHROPIC_API_KEY: "sk-env", XDG_CONFIG_HOME: "/cfg" }
    );
    expect(view).toEqual({
      provider: "openai",
      model: "",
      defaultModel: "gpt-5",
      connections: {
        anthropic: { source: "env", hint: "" },
        openai: { source: "saved", hint: "…1234" },
        google: null,
        xai: null,
        mistral: null,
        groq: null,
        openrouter: null,
        gateway: null,
        compatible: null,
      },
      baseUrl: "",
      file: "/cfg/coss-vaunt/settings.json",
    });
    expect(JSON.stringify(view)).not.toContain("sk-");
  });
});

describe("the settings file", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "ai-settings-"));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("round-trips, readable only by the user", async () => {
    const file = aiSettingsFile({ XDG_CONFIG_HOME: dir });
    expect(await readAiSettings(file)).toBeNull();
    await writeAiSettings(saved, file);
    expect(await readAiSettings(file)).toEqual(saved);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ version: 2, ai: saved });
  });

  it("throws on a damaged file rather than forgetting the keys", async () => {
    const file = path.join(dir, "settings.json");
    await writeFile(file, "{ not json");
    await expect(readAiSettings(file)).rejects.toThrow();
  });
});
