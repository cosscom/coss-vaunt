"use client";

import { Button } from "@coss/ui/components/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { SettingsIcon } from "@coss/ui/icons";
import type * as React from "react";
import { useSettings } from "./settings-provider";
import { shortcutKeys } from "@/modules/editor/editor-keymap";
import { useIsMac } from "@/modules/editor/use-is-mac";
import { STUDIO_COPY } from "@/modules/studio-copy";

/** The gear in the title bars: opens Settings at its AI section, where keys and the model are. */
export function SettingsButton({ className }: { className?: string }): React.ReactElement {
  const settings = useSettings();
  const mac = useIsMac();
  const label = STUDIO_COPY.settings.aiSettings;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            className={className}
            onClick={() => settings.open("ai")}
            size="icon-sm"
            variant="ghost"
          />
        }>
        <SettingsIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipPopup>{`${label} (${shortcutKeys("open-settings", mac).join(mac ? "" : "+")})`}</TooltipPopup>
    </Tooltip>
  );
}
