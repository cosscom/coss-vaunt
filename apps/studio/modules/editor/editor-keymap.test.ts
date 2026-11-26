import { describe, expect, it } from "vitest";
import { comboKeys, KEYMAP, matchShortcut } from "./editor-keymap";

const press = (key: string, options: Partial<Omit<KeyboardEvent, "key">> = {}) =>
  matchShortcut({
    key,
    code: options.code ?? (key.length === 1 && /[a-z]/i.test(key) ? `Key${key.toUpperCase()}` : ""),
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...options,
  });

describe("matchShortcut", () => {
  it("maps playback keys, with Shift stepping a second", () => {
    expect([press(" "), press("ArrowLeft"), press("ArrowRight", { shiftKey: true }), press("End")]).toEqual([
      "toggle-play",
      "step-back",
      "step-forward-second",
      "go-to-end",
    ]);
  });

  it("tells undo from redo and works with Ctrl or ⌘", () => {
    expect([
      press("z", { metaKey: true }),
      press("z", { ctrlKey: true, shiftKey: true }),
      press("y", { ctrlKey: true }),
    ]).toEqual(["undo", "redo", "redo"]);
  });

  it("opens the agent with ⌘L and AI settings with ⌘I", () => {
    expect([press("l", { metaKey: true }), press("i", { ctrlKey: true }), press("l")]).toEqual([
      "toggle-agent",
      "open-ai-settings",
      null,
    ]);
  });

  it("separates K, Shift+K and ⌥K by physical key", () => {
    expect([press("k"), press("K", { shiftKey: true }), press("˚", { altKey: true, code: "KeyK" })]).toEqual([
      "toggle-keyframe",
      "toggle-camera-keyframes",
      "add-camera-keyframes",
    ]);
  });

  it("matches typed characters that need Shift", () => {
    expect([press("?", { shiftKey: true }), press("+", { shiftKey: true }), press("=")]).toEqual([
      "show-shortcuts",
      "zoom-in",
      "zoom-in",
    ]);
  });

  it("ignores browser shortcuts it doesn't own", () => {
    expect([press("s", { metaKey: true }), press("a")]).toEqual([null, null]);
  });
});

describe("comboKeys", () => {
  it("labels keys per platform", () => {
    expect(comboKeys({ code: "KeyZ", mod: true, shift: true }, true)).toEqual(["⌘", "⇧", "Z"]);
    expect(comboKeys({ code: "KeyZ", mod: true, shift: true }, false)).toEqual(["Ctrl", "Shift", "Z"]);
    expect(comboKeys({ key: "?", shift: true }, true)).toEqual(["?"]);
  });

  it("gives every action a binding", () => {
    expect(new Set(KEYMAP.map((binding) => binding.action)).size).toBe(KEYMAP.length);
  });
});
