"use client";

import { toastManager } from "@coss/ui/components/toast";
import { type Appearance, DEFAULT_APPEARANCE } from "@coss/vaunt-engine/settings/appearance";
import type * as React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { glassAttributes } from "./appearance";
import { SettingsScreen } from "./settings-screen";
import type { SettingsSection } from "./settings-sections";
import { canUseGlass, setWindowGlass } from "@/modules/desktop/desktop-window";
import { STUDIO_COPY } from "@/modules/studio-copy";

const APPEARANCE_URL = "/api/settings/appearance";

type SettingsContextValue = {
  /** Opens Settings, at `section` or wherever it was last. */
  open: (section?: SettingsSection) => void;
  appearance: Appearance;
  /** Whether glass can show here: the desktop window on macOS. */
  glassCapable: boolean;
  /** Saves a change; it shows at once and goes back if saving fails. */
  updateAppearance: (change: Partial<Appearance>) => Promise<void>;
  /** Shows a change without saving it, as a slider drags; `updateAppearance` saves it when let go. */
  previewAppearance: (change: Partial<Appearance>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings needs a SettingsProvider");
  return value;
}

/** Puts the appearance on `<html>` for globals.css and on the window itself. */
function applyAppearance(appearance: Appearance, capable: boolean): void {
  const { glass, tint } = glassAttributes(appearance, capable);
  const root = document.documentElement;
  root.toggleAttribute("data-glass", glass);
  root.style.setProperty("--glass-tint", tint);
  if (capable) void setWindowGlass(glass);
}

/**
 * Settings on every page: the full-window screen (⌘, opens it, Esc closes it) and the appearance it edits, which is
 * read from the server once and applied to the page and the desktop window.
 */
export function SettingsProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [isOpen, setOpen] = useState(false);
  const [section, setSection] = useState<SettingsSection>("general");
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [glassCapable, setGlassCapable] = useState(false);

  useEffect(() => {
    const capable = canUseGlass();
    setGlassCapable(capable);
    let cancelled = false;
    fetch(APPEARANCE_URL)
      .then((response) => (response.ok ? (response.json() as Promise<Appearance>) : null))
      .then((loaded) => {
        if (cancelled || !loaded) return;
        setAppearance(loaded);
        setSaved(loaded);
        applyAppearance(loaded, capable);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "," || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // What was last saved, to go back to if a save fails; a preview doesn't move it.
  const [saved, setSaved] = useState<Appearance>(DEFAULT_APPEARANCE);

  const previewAppearance = useCallback(
    (change: Partial<Appearance>) => {
      const next = { ...appearance, ...change };
      setAppearance(next);
      applyAppearance(next, glassCapable);
    },
    [appearance, glassCapable]
  );

  const updateAppearance = useCallback(
    async (change: Partial<Appearance>) => {
      const previous = saved;
      const next = { ...appearance, ...change };
      setAppearance(next);
      applyAppearance(next, glassCapable);
      try {
        const response = await fetch(APPEARANCE_URL, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(change),
        });
        if (!response.ok) throw new Error(response.statusText);
        setSaved((await response.json()) as Appearance);
      } catch {
        setAppearance(previous);
        applyAppearance(previous, glassCapable);
        toastManager.add({ type: "error", title: STUDIO_COPY.settings.saveFailed });
      }
    },
    [appearance, saved, glassCapable]
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      open: (target) => {
        if (target) setSection(target);
        setOpen(true);
      },
      appearance,
      glassCapable,
      updateAppearance,
      previewAppearance,
    }),
    [appearance, glassCapable, updateAppearance, previewAppearance]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
      <SettingsScreen onOpenChange={setOpen} onSectionChange={setSection} open={isOpen} section={section} />
    </SettingsContext.Provider>
  );
}
