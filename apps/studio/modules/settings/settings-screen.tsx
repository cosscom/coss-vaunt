"use client";

import { Button } from "@coss/ui/components/button";
import { Dialog, DialogPortal, DialogPrimitive } from "@coss/ui/components/dialog";
import { Kbd } from "@coss/ui/components/kbd";
import { toastManager } from "@coss/ui/components/toast";
import {
  InfoIcon,
  KeyboardIcon,
  PaletteIcon,
  RotateCcwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  XIcon,
} from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import type { AiSettingsView } from "@coss/vaunt-engine/ai/ai-providers";
import { DEFAULT_APPEARANCE } from "@coss/vaunt-engine/settings/appearance";
import { useTheme } from "next-themes";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { AboutSection } from "./about-section";
import { AI_SETTINGS_URL, AiSection, saveAiSettings } from "./ai-section";
import { AppearanceSection } from "./appearance-section";
import { type AboutInfo, GeneralSection } from "./general-section";
import { KeybindingsSection } from "./keybindings-section";
import { useSettings } from "./settings-provider";
import { SETTINGS_NAV, type SettingsSection, searchSettings } from "./settings-sections";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.settings;

const ICONS: Record<SettingsSection, React.ComponentType<{ className?: string; "aria-hidden"?: "true" }>> = {
  general: SlidersHorizontalIcon,
  appearance: PaletteIcon,
  ai: SparklesIcon,
  keybindings: KeyboardIcon,
  about: InfoIcon,
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(response.statusText);
  return (await response.json()) as T;
}

function SettingsNav({
  section,
  onSectionChange,
}: {
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}): React.ReactElement {
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const matches = searchSettings(query);

  // `/` jumps to the search field, unless it's being typed somewhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (
        event.target instanceof Element &&
        event.target.closest("input, textarea, [contenteditable='true']")
      )
        return;
      event.preventDefault();
      search.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <nav aria-label={copy.title} className="flex w-60 shrink-0 flex-col gap-3 border-e bg-muted/40 p-2">
      <label className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-muted-foreground text-sm focus-within:bg-accent">
        <SearchIcon aria-hidden="true" className="size-4 shrink-0" />
        <input
          aria-label={copy.searchLabel}
          className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            const first = matches[0];
            if (event.key === "Enter" && first) onSectionChange(first);
            // Esc clears the search first, then closes Settings.
            if (event.key === "Escape" && query) {
              event.preventDefault();
              event.stopPropagation();
              setQuery("");
            }
          }}
          placeholder={copy.search}
          ref={search}
          spellCheck={false}
          value={query}
        />
        <Kbd>/</Kbd>
      </label>
      {matches.length === 0 ? <p className="px-2.5 text-muted-foreground text-sm">{copy.noResults}</p> : null}
      {SETTINGS_NAV.map((group) => {
        const sections = group.sections.filter((id) => matches.includes(id));
        if (sections.length === 0) return null;
        return (
          <div className="flex flex-col gap-0.5" key={group.label ?? "top"}>
            {group.label ? (
              <h3 className="px-2.5 pt-2 pb-1 text-muted-foreground text-xs">{group.label}</h3>
            ) : null}
            {sections.map((id) => {
              const Icon = ICONS[id];
              return (
                <button
                  aria-current={id === section ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-start text-muted-foreground text-sm outline-none transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                    id === section && "bg-accent text-foreground hover:bg-accent"
                  )}
                  key={id}
                  onClick={() => onSectionChange(id)}
                  type="button">
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  {copy.sections[id]}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

/**
 * Settings, over the whole window: a nav of sections on the left (with search), and the section as groups of rows
 * on the right under a "Settings / Section" breadcrumb. ⌘, opens it (settings-provider.tsx), Esc or × closes it.
 */
export function SettingsScreen({
  open,
  onOpenChange,
  section,
  onSectionChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}): React.ReactElement {
  const { setTheme } = useTheme();
  const { updateAppearance } = useSettings();
  const [aiView, setAiView] = useState<AiSettingsView | null>(null);
  const [about, setAbout] = useState<AboutInfo | null>(null);

  // Read fresh each time it opens, so a key or model changed elsewhere (the composer's picker) shows.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([getJson<AiSettingsView>(AI_SETTINGS_URL), getJson<AboutInfo>("/api/settings/about")])
      .then(([view, info]) => {
        if (cancelled) return;
        setAiView(view);
        setAbout(info);
      })
      .catch(() => {
        if (!cancelled) toastManager.add({ type: "error", title: copy.loadFailed });
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Back to the defaults for everything but the connections: keys stay.
  const restoreDefaults = async () => {
    setTheme("system");
    try {
      await updateAppearance(DEFAULT_APPEARANCE);
      if (aiView?.model) setAiView(await saveAiSettings({ model: "" }));
      toastManager.add({ type: "success", title: copy.restored });
    } catch {
      toastManager.add({ type: "error", title: copy.restoreFailed });
    }
  };

  const close = () => onOpenChange(false);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPortal>
        <DialogPrimitive.Popup
          className="fixed inset-0 z-50 flex flex-col bg-(--editor-shell-color) p-2.5 pt-[max(var(--titlebar-inset,0px),10px)] outline-none transition-[opacity,scale] duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:data-ending-style:scale-[0.99] motion-safe:data-starting-style:scale-[0.99]"
          data-slot="settings-screen">
          {/* The desktop window's buttons sit in this strip; it drags the window, as the title bar would. */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-(--titlebar-inset)"
            data-tauri-drag-region
          />
          <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border bg-background">
            <SettingsNav onSectionChange={onSectionChange} section={section} />
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex h-12 shrink-0 items-center gap-2 border-b ps-6 pe-2">
                <DialogPrimitive.Title className="flex min-w-0 flex-1 items-center gap-2 font-normal text-sm">
                  <span className="text-muted-foreground">{copy.title}</span>
                  <span aria-hidden="true" className="text-muted-foreground/60">
                    /
                  </span>
                  <span className="truncate font-medium">{copy.sections[section]}</span>
                </DialogPrimitive.Title>
                <Button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => void restoreDefaults()}
                  size="sm"
                  variant="ghost">
                  <RotateCcwIcon aria-hidden="true" />
                  {copy.restoreDefaults}
                </Button>
                <Button aria-label={copy.close} onClick={close} size="icon-sm" variant="ghost">
                  <XIcon aria-hidden="true" />
                </Button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-8">
                  {section === "general" ? <GeneralSection about={about} onClose={close} /> : null}
                  {section === "appearance" ? <AppearanceSection /> : null}
                  {section === "ai" ? <AiSection onViewChange={setAiView} view={aiView} /> : null}
                  {section === "keybindings" ? <KeybindingsSection /> : null}
                  {section === "about" ? <AboutSection about={about} /> : null}
                </div>
              </div>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
