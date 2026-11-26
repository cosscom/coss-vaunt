"use client";

import { Button } from "@coss/ui/components/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
} from "@coss/ui/components/menu";
import { toastManager } from "@coss/ui/components/toast";
import { ChevronDownIcon, SparklesIcon } from "@coss/ui/icons";
import {
  AI_PROVIDERS,
  type AiProvider,
  type AiSettingsView,
  MODEL_CHOICES,
} from "@coss/vaunt-engine/ai/ai-providers";
import type * as React from "react";
import { useEffect, useState } from "react";
import { useIsMac } from "@/modules/editor/use-is-mac";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.agent;
const SETTINGS_URL = "/api/settings/ai";

/** `provider:model`, the radio value for a choice. */
const choiceValue = (provider: AiProvider, model: string) => `${provider}:${model}`;

function activeLabel(view: AiSettingsView | null): string {
  if (!view) return "";
  const model = view.model || view.defaultModel;
  return MODEL_CHOICES[view.provider].find((choice) => choice.id === model)?.label ?? model;
}

/**
 * The composer's model switch. It writes the studio's one AI setting, the same one AI settings edits, so a model
 * picked here is the one that plans boards too. Providers without a key can't be picked.
 */
export function ModelPicker({ onOpenSettings }: { onOpenSettings: () => void }): React.ReactElement {
  const mac = useIsMac();
  const [view, setView] = useState<AiSettingsView | null>(null);

  const load = async () => {
    try {
      const response = await fetch(SETTINGS_URL);
      if (response.ok) setView((await response.json()) as AiSettingsView);
    } catch {
      // The picker just keeps its last label; AI settings reports load failures.
    }
  };
  useEffect(() => void load(), []);

  const choose = async (value: string) => {
    const [provider, ...rest] = value.split(":") as [AiProvider, ...string[]];
    const previous = view;
    // Optimistic: the label switches at once and goes back if the save fails.
    if (view) setView({ ...view, provider, model: rest.join(":") });
    try {
      const response = await fetch(SETTINGS_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model: rest.join(":") }),
      });
      if (!response.ok) throw new Error(response.statusText);
      setView((await response.json()) as AiSettingsView);
    } catch {
      setView(previous);
      toastManager.add({ type: "error", title: copy.switchFailed });
    }
  };

  const label = activeLabel(view);
  return (
    <Menu onOpenChange={(open) => open && void load()}>
      <MenuTrigger
        render={
          <Button
            aria-label={copy.model(label)}
            className="gap-1 px-2 text-muted-foreground hover:text-foreground"
            size="xs"
            type="button"
            variant="ghost"
          />
        }>
        <SparklesIcon aria-hidden="true" />
        <span className="max-w-28 truncate">{label}</span>
        <ChevronDownIcon aria-hidden="true" className="opacity-64" />
      </MenuTrigger>
      <MenuPopup align="start" className="min-w-56" side="top">
        <MenuRadioGroup
          onValueChange={(value: string) => void choose(value)}
          value={view ? choiceValue(view.provider, view.model || view.defaultModel) : ""}>
          {AI_PROVIDERS.map((provider) => {
            const keyed = view?.keys[provider] != null;
            return (
              <MenuGroup key={provider}>
                <MenuGroupLabel className="flex items-center justify-between gap-4">
                  {copy.providers[provider]}
                  {keyed ? null : <span className="font-normal opacity-72">{copy.noKey}</span>}
                </MenuGroupLabel>
                {MODEL_CHOICES[provider].map((choice) => (
                  <MenuRadioItem disabled={!keyed} key={choice.id} value={choiceValue(provider, choice.id)}>
                    {choice.label}
                  </MenuRadioItem>
                ))}
              </MenuGroup>
            );
          })}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem onClick={onOpenSettings}>
          {copy.openSettings}
          <MenuShortcut>{mac ? "⌘I" : "Ctrl+I"}</MenuShortcut>
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
