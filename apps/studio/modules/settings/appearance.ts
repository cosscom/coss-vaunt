import type { Appearance } from "@coss/vaunt-engine/settings/appearance";

/**
 * What the page sets on `<html>` for an appearance: `data-glass` when glass applies (it's on, and the page is in the
 * desktop window on macOS), and the tint as a percentage for globals.css to mix the shell's color with.
 */
export function glassAttributes(appearance: Appearance, capable: boolean): { glass: boolean; tint: string } {
  const percent = Math.round(Math.min(100, Math.max(0, appearance.tint)));
  return { glass: capable && appearance.glass, tint: `${percent}%` };
}
