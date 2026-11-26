"use client";

import { Dialog, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@coss/ui/components/dialog";
import { Kbd, KbdGroup } from "@coss/ui/components/kbd";
import type * as React from "react";
import { comboKeys, KEYMAP, type ShortcutGroup } from "./editor-keymap";
import { useIsMac } from "./use-is-mac";
import { STUDIO_COPY } from "@/modules/studio-copy";

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  "Playback",
  "Editing",
  "Keyframes",
  "Timeline",
  "Agent",
  "Help",
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const mac = useIsMac();
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{STUDIO_COPY.shortcuts.title}</DialogTitle>
        </DialogHeader>
        <DialogPanel className="grid grid-cols-2 gap-x-8 gap-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <section className="flex flex-col gap-1.5" key={group}>
              <h3 className="font-medium text-muted-foreground text-xs">
                {STUDIO_COPY.shortcuts.groups[group]}
              </h3>
              <dl className="flex flex-col gap-1">
                {KEYMAP.filter((binding) => binding.group === group).map((binding) => (
                  <div className="flex items-center justify-between gap-4 text-sm" key={binding.action}>
                    <dt className="text-foreground">{binding.label}</dt>
                    <dd className="flex shrink-0 items-center gap-1.5">
                      {binding.combos.map((combo) => (
                        <KbdGroup key={comboKeys(combo, mac).join("+")}>
                          {comboKeys(combo, mac).map((key) => (
                            <Kbd key={key}>{key}</Kbd>
                          ))}
                        </KbdGroup>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
