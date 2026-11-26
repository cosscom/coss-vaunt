"use client";

import type * as React from "react";
import type { AboutInfo } from "./general-section";
import { SettingsGroup, SettingsRow } from "./settings-rows";
import { isDesktopWindow } from "@/modules/desktop/desktop-window";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.settings.about;

export function AboutSection({ about }: { about: AboutInfo | null }): React.ReactElement {
  return (
    <SettingsGroup description={copy.description} title={copy.title}>
      <SettingsRow
        control={
          <span className="font-mono text-muted-foreground text-sm tabular-nums">
            {about?.version ?? "dev"}
          </span>
        }
        title={copy.version}
      />
      <SettingsRow
        control={
          <span className="text-muted-foreground text-sm">
            {isDesktopWindow() ? copy.desktop : copy.browser}
          </span>
        }
        title={copy.runtime}
      />
    </SettingsGroup>
  );
}
