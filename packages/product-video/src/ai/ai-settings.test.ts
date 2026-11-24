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
    expect(resolveAi(null, {})).toBeNull();
    expect(resolveAi({ provider: "gateway", apiKeys: {} }, { ANTHROPIC_API_KEY: "x" })).toBeNull();
  });
});

describe("applyAiSettingsUpdate", () => {
  it("keeps a saved key when the update leaves it out, and removes it on null", () => {
    expect(applyAiSettingsUpdate(saved, { provider: "openai" }).apiKeys.openai).toBe("sk-saved");
    expect(applyAiSettingsUpdate(saved, { provider: "openai", apiKey: null }).apiKeys).toEqual({
      anthropic: "sk-ant",
    });
    expect(applyAiSettingsUpdate(null, { provider: "anthropic", apiKey: "new", model: "" })).toEqual({
      provider: "anthropic",
      model: undefined,
      apiKeys: { anthropic: "new" },
    });
  });
});

describe("aiSettingsView", () => {
  it("says where each key comes from without the key itself", () => {
    const view = aiSettingsView(saved, { ANTHROPIC_API_KEY: "sk-env", XDG_CONFIG_HOME: "/cfg" });
    expect(view).toEqual({
      provider: "openai",
      model: "",
      defaultModel: "gpt-5",
      keys: { anthropic: "env", openai: "saved", gateway: null },
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
    expect(await readFile(file, "utf8")).toContain('"provider": "openai"');
  });

  it("throws on a damaged file rather than forgetting the keys", async () => {
    const file = path.join(dir, "settings.json");
    await writeFile(file, "{ not json");
    await expect(readAiSettings(file)).rejects.toThrow();
  });
});
