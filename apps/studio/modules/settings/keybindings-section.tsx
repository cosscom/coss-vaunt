"use client";

import { Kbd, KbdGroup } from "@coss/ui/components/kbd";
import type * as React from "react";
import { SettingsGroup, SettingsRow } from "./settings-rows";
import { comboKeys, KEYMAP } from "@/modules/editor/editor-keymap";
import { SHORTCUT_GROUPS } from "@/modules/editor/shortcuts-dialog";
import { useIsMac } from "@/modules/editor/use-is-mac";
import { STUDIO_COPY } from "@/modules/studio-copy";

/** The editor's keymap, read-only, grouped as the shortcuts dialog groups it. */
export function KeybindingsSection(): React.ReactElement {
  const mac = useIsMac();
  return (
    <>
      <p className="px-1 text-muted-foreground text-sm">{STUDIO_COPY.settings.keybindings.description}</p>
      {SHORTCUT_GROUPS.map((group) => (
        <SettingsGroup key={group} title={STUDIO_COPY.shortcuts.groups[group]}>
          {KEYMAP.filter((binding) => binding.group === group).map((binding) => (
            <SettingsRow
              className="py-2.5"
              control={binding.combos.map((combo) => (
                <KbdGroup key={comboKeys(combo, mac).join("+")}>
                  {comboKeys(combo, mac).map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </KbdGroup>
              ))}
              key={binding.action}
              title={<span className="font-normal">{binding.label}</span>}
            />
          ))}
        </SettingsGroup>
      ))}
    </>
  );
}
