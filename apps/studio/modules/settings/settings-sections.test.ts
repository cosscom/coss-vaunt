import { describe, expect, it } from "vitest";
import { SETTINGS_NAV, SETTINGS_SECTIONS, searchSettings } from "./settings-sections";

describe("searchSettings", () => {
  it("lists every section for an empty query", () => {
    expect(searchSettings("  ")).toEqual([...SETTINGS_SECTIONS]);
  });

  it("matches section names and the rows inside them, ignoring case", () => {
    expect(searchSettings("appear")).toEqual(["appearance"]);
    expect(searchSettings("GLASS")).toEqual(["appearance"]);
    expect(searchSettings("ollama")).toEqual(["ai"]);
    expect(searchSettings("gemini")).toEqual(["ai"]);
    expect(searchSettings("shortcuts")).toEqual(["keybindings"]);
  });

  it("needs every word to match", () => {
    expect(searchSettings("dark theme")).toEqual(["appearance"]);
    expect(searchSettings("dark ollama")).toEqual([]);
  });
});

describe("SETTINGS_NAV", () => {
  it("shows each section exactly once", () => {
    expect(SETTINGS_NAV.flatMap((group) => group.sections).sort()).toEqual([...SETTINGS_SECTIONS].sort());
  });
});
