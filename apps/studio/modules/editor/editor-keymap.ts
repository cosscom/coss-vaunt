/** `mod` is ⌘ on macOS and Ctrl elsewhere. Letters match by physical key so ⌥ combos work on macOS. */
type KeyCombo = { key?: string; code?: string; mod?: boolean; shift?: boolean; alt?: boolean };

type KeyPress = Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">;

export type EditorAction =
  | "toggle-play"
  | "step-back"
  | "step-forward"
  | "step-back-second"
  | "step-forward-second"
  | "go-to-start"
  | "go-to-end"
  | "toggle-keyframe"
  | "toggle-camera-keyframes"
  | "add-camera-keyframes"
  | "previous-keyframe"
  | "next-keyframe"
  | "nudge-back"
  | "nudge-forward"
  | "delete-selection"
  | "duplicate"
  | "split"
  | "copy"
  | "paste"
  | "select-all"
  | "undo"
  | "redo"
  | "zoom-in"
  | "zoom-out"
  | "zoom-to-fit"
  | "toggle-agent"
  | "open-ai-settings"
  | "show-shortcuts";

export type ShortcutGroup = "Playback" | "Editing" | "Keyframes" | "Timeline" | "Agent" | "Help";

/** Window-level shortcuts that work while typing too, so ⌘L can close the agent from its own composer. */
export const GLOBAL_ACTIONS: readonly EditorAction[] = ["toggle-agent", "open-ai-settings"];

type Binding = { action: EditorAction; label: string; group: ShortcutGroup; combos: KeyCombo[] };

export const KEYMAP: Binding[] = [
  { action: "toggle-play", label: "Play or pause", group: "Playback", combos: [{ key: " " }] },
  { action: "step-back", label: "Previous frame", group: "Playback", combos: [{ key: "ArrowLeft" }] },
  { action: "step-forward", label: "Next frame", group: "Playback", combos: [{ key: "ArrowRight" }] },
  {
    action: "step-back-second",
    label: "Back one second",
    group: "Playback",
    combos: [{ key: "ArrowLeft", shift: true }],
  },
  {
    action: "step-forward-second",
    label: "Forward one second",
    group: "Playback",
    combos: [{ key: "ArrowRight", shift: true }],
  },
  { action: "go-to-start", label: "Go to start", group: "Playback", combos: [{ key: "Home" }] },
  { action: "go-to-end", label: "Go to end", group: "Playback", combos: [{ key: "End" }] },
  { action: "undo", label: "Undo", group: "Editing", combos: [{ code: "KeyZ", mod: true }] },
  {
    action: "redo",
    label: "Redo",
    group: "Editing",
    combos: [
      { code: "KeyZ", mod: true, shift: true },
      { code: "KeyY", mod: true },
    ],
  },
  {
    action: "copy",
    label: "Copy clips or keyframes",
    group: "Editing",
    combos: [{ code: "KeyC", mod: true }],
  },
  { action: "paste", label: "Paste at playhead", group: "Editing", combos: [{ code: "KeyV", mod: true }] },
  { action: "duplicate", label: "Duplicate", group: "Editing", combos: [{ code: "KeyD", mod: true }] },
  { action: "split", label: "Split at playhead", group: "Editing", combos: [{ code: "KeyS" }] },
  {
    action: "delete-selection",
    label: "Delete",
    group: "Editing",
    combos: [{ key: "Backspace" }, { key: "Delete" }],
  },
  {
    action: "select-all",
    label: "Select all clips",
    group: "Editing",
    combos: [{ code: "KeyA", mod: true }],
  },
  { action: "nudge-back", label: "Nudge back one frame", group: "Editing", combos: [{ key: "," }] },
  { action: "nudge-forward", label: "Nudge forward one frame", group: "Editing", combos: [{ key: "." }] },
  {
    action: "toggle-keyframe",
    label: "Keyframe the selected lanes or last edited property",
    group: "Keyframes",
    combos: [{ code: "KeyK" }],
  },
  {
    action: "toggle-camera-keyframes",
    label: "Keyframe the whole group",
    group: "Keyframes",
    combos: [{ code: "KeyK", shift: true }],
  },
  {
    action: "add-camera-keyframes",
    label: "Add camera keyframes",
    group: "Keyframes",
    combos: [{ code: "KeyK", alt: true }],
  },
  { action: "previous-keyframe", label: "Previous keyframe", group: "Keyframes", combos: [{ key: "[" }] },
  { action: "next-keyframe", label: "Next keyframe", group: "Keyframes", combos: [{ key: "]" }] },
  { action: "zoom-in", label: "Zoom in", group: "Timeline", combos: [{ key: "+" }, { key: "=" }] },
  { action: "zoom-out", label: "Zoom out", group: "Timeline", combos: [{ key: "-" }] },
  { action: "zoom-to-fit", label: "Zoom to fit", group: "Timeline", combos: [{ code: "KeyZ", shift: true }] },
  {
    action: "toggle-agent",
    label: "Show or hide the agent",
    group: "Agent",
    combos: [{ code: "KeyL", mod: true }],
  },
  { action: "open-ai-settings", label: "AI settings", group: "Agent", combos: [{ code: "KeyI", mod: true }] },
  {
    action: "show-shortcuts",
    label: "Keyboard shortcuts",
    group: "Help",
    combos: [{ key: "?", shift: true }],
  },
];

/** Shift is part of the character for these keys, so it isn't compared. */
const SHIFTED_KEYS = new Set(["?", "+"]);

function matches(combo: KeyCombo, press: KeyPress): boolean {
  if (combo.code ? press.code !== combo.code : press.key !== combo.key) return false;
  if (Boolean(combo.mod) !== (press.metaKey || press.ctrlKey)) return false;
  if (Boolean(combo.alt) !== press.altKey) return false;
  return (combo.key !== undefined && SHIFTED_KEYS.has(combo.key)) || Boolean(combo.shift) === press.shiftKey;
}

export function matchShortcut(press: KeyPress): EditorAction | null {
  return KEYMAP.find((binding) => binding.combos.some((combo) => matches(combo, press)))?.action ?? null;
}

const KEY_LABELS: Record<string, string> = {
  " ": "Space",
  ArrowLeft: "←",
  ArrowRight: "→",
  Backspace: "⌫",
  Delete: "Del",
};

/** Key caps for one combo, e.g. `["⌘", "⇧", "Z"]`. */
export function comboKeys(combo: KeyCombo, mac: boolean): string[] {
  const key = combo.code ? combo.code.replace(/^Key/, "") : (KEY_LABELS[combo.key ?? ""] ?? combo.key ?? "");
  return [
    ...(combo.mod ? [mac ? "⌘" : "Ctrl"] : []),
    ...(combo.alt ? [mac ? "⌥" : "Alt"] : []),
    ...(combo.shift && !SHIFTED_KEYS.has(combo.key ?? "") ? [mac ? "⇧" : "Shift"] : []),
    key,
  ];
}

export function shortcutKeys(action: EditorAction, mac: boolean): string[] {
  const combo = KEYMAP.find((binding) => binding.action === action)?.combos[0];
  return combo ? comboKeys(combo, mac) : [];
}
