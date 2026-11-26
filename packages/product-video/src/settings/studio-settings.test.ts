import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appearanceOf,
  DEFAULT_APPEARANCE,
  DEFAULT_EDITOR_PREFERENCES,
  editorPreferencesOf,
  migrateSettings,
  readStudioSettings,
  updateStudioSettings,
} from "./studio-settings";

const ai = { provider: "anthropic" as const, model: "claude-sonnet-5-5", apiKeys: { anthropic: "sk-ant" } };

describe("migrateSettings", () => {
  it("moves version 1, the AI settings alone, into the ai section", () => {
    expect(migrateSettings(ai)).toEqual({ version: 2, ai });
  });

  it("reads version 2 as it is", () => {
    const current = { version: 2, ai, appearance: { glass: true, tint: 40 } };
    expect(migrateSettings(current)).toEqual(current);
    expect(migrateSettings({ version: 2 })).toEqual({ version: 2 });
  });

  it("throws on what it can't read rather than dropping keys", () => {
    expect(() => migrateSettings({ provider: "nobody", apiKeys: {} })).toThrow();
    expect(() => migrateSettings({ version: 3 })).toThrow();
    expect(() => migrateSettings({ version: 2, appearance: { glass: true, tint: 400 } })).toThrow();
    expect(() => migrateSettings({ version: 2, ai: { ...ai, baseUrl: "file:///etc" } })).toThrow();
  });
});

describe("appearanceOf", () => {
  it("defaults to no glass", () => {
    expect(appearanceOf({ version: 2 })).toEqual(DEFAULT_APPEARANCE);
    expect(DEFAULT_APPEARANCE.glass).toBe(false);
  });
});

describe("editorPreferencesOf", () => {
  it("defaults to selecting on hover after 800 ms, and reads a saved choice", () => {
    expect(editorPreferencesOf({ version: 2 })).toEqual(DEFAULT_EDITOR_PREFERENCES);
    expect(DEFAULT_EDITOR_PREFERENCES.hoverSelectDelayMs).toBe(800);
    const editor = { hoverSelect: false, hoverSelectDelayMs: 1200 };
    expect(editorPreferencesOf(migrateSettings({ version: 2, editor }))).toEqual(editor);
    expect(() =>
      migrateSettings({ version: 2, editor: { hoverSelect: true, hoverSelectDelayMs: 50 } })
    ).toThrow();
  });
});

describe("the settings file", () => {
  let dir: string;
  let file: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "studio-settings-"));
    file = path.join(dir, "settings.json");
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("is empty when there's no file yet", async () => {
    expect(await readStudioSettings(file)).toEqual({ version: 2 });
  });

  it("migrates a version 1 file on the next write, keeping its keys", async () => {
    await writeFile(file, JSON.stringify(ai));
    await updateStudioSettings((settings) => ({ ...settings, appearance: { glass: true, tint: 50 } }), file);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({
      version: 2,
      ai,
      appearance: { glass: true, tint: 50 },
    });
  });
});
