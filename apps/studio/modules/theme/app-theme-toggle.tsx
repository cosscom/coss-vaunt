"use client";

import { Button } from "@coss/ui/components/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { MoonIcon, SunIcon } from "@coss/ui/icons";
import { useTheme } from "next-themes";
import type * as React from "react";
import { STUDIO_COPY } from "@/modules/studio-copy";

export function AppThemeToggle(): React.ReactElement {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={STUDIO_COPY.toggleAppTheme}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            size="icon-sm"
            variant="ghost"
          />
        }>
        <SunIcon className="dark:hidden" aria-hidden="true" />
        <MoonIcon className="not-dark:hidden" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipPopup>{STUDIO_COPY.toggleAppTheme}</TooltipPopup>
    </Tooltip>
  );
}
