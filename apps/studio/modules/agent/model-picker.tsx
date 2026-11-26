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
import { ChevronDownIcon } from "@coss/ui/icons";
import type { AiSettingsView } from "@coss/vaunt-engine/ai/ai-providers";
import type * as React from "react";
import { useEffect, useState } from "react";
import { shortcutKeys } from "@/modules/editor/editor-keymap";
import { useIsMac } from "@/modules/editor/use-is-mac";
import {
  activeModel,
  activeModelLabel,
  choiceValue,
  modelGroups,
  parseChoice,
} from "@/modules/settings/ai-connections";
import { AI_SETTINGS_URL, saveAiSettings } from "@/modules/settings/ai-section";
import { ProviderMark } from "@/modules/settings/provider-logo";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.agent;
const providerNames = STUDIO_COPY.settings.ai.providers;

/**
 * The composer's model switch. It writes the studio's one AI setting, the same one Settings › AI edits, so a model
 * picked here is the one that plans boards too. It lists the models of each connected provider.
 */
export function ModelPicker({ onOpenSettings }: { onOpenSettings: () => void }): React.ReactElement {
  const mac = useIsMac();
  const [view, setView] = useState<AiSettingsView | null>(null);

  const load = async () => {
    try {
      const response = await fetch(AI_SETTINGS_URL);
      if (response.ok) setView((await response.json()) as AiSettingsView);
    } catch {
      // The picker just keeps its last label; AI settings reports load failures.
    }
  };
  useEffect(() => void load(), []);

  const choose = async (value: string) => {
    const choice = parseChoice(value);
    if (!choice) return;
    const previous = view;
    // Optimistic: the label switches at once and goes back if the save fails.
    if (view) setView({ ...view, ...choice });
    try {
      setView(await saveAiSettings(choice));
    } catch {
      setView(previous);
      toastManager.add({ type: "error", title: copy.switchFailed });
    }
  };

  const label = view ? activeModelLabel(view) : "";
  const groups = view ? modelGroups(view) : [];
  return (
    <Menu onOpenChange={(open) => open && void load()}>
      <MenuTrigger
        render={
          <Button
            aria-label={copy.model(label)}
            className="gap-1.5 px-2 text-muted-foreground hover:text-foreground"
            size="xs"
            type="button"
            variant="ghost"
          />
        }>
        {view ? <ProviderMark className="size-3.5" provider={view.provider} /> : null}
        <span className="max-w-28 truncate">{label}</span>
        <ChevronDownIcon aria-hidden="true" className="opacity-64" />
      </MenuTrigger>
      <MenuPopup align="start" className="min-w-56" side="top">
        {groups.length === 0 ? <MenuGroupLabel>{copy.noProviders}</MenuGroupLabel> : null}
        <MenuRadioGroup
          onValueChange={(value: string) => void choose(value)}
          value={view ? choiceValue(view.provider, activeModel(view)) : ""}>
          {groups.map((group) => (
            <MenuGroup key={group.provider}>
              <MenuGroupLabel className="flex items-center gap-1.5">
                <ProviderMark className="size-3" provider={group.provider} />
                {providerNames[group.provider]}
              </MenuGroupLabel>
              {group.models.map((model) => (
                <MenuRadioItem key={model.id} value={choiceValue(group.provider, model.id)}>
                  {model.label}
                </MenuRadioItem>
              ))}
            </MenuGroup>
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem onClick={onOpenSettings}>
          {copy.openSettings}
          <MenuShortcut>{shortcutKeys("open-settings", mac).join(mac ? "" : "+")}</MenuShortcut>
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
