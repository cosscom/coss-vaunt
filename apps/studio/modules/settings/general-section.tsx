"use client";

import { Button } from "@coss/ui/components/button";
import Link from "next/link";
import type * as React from "react";
import { SettingsGroup, SettingsRow } from "./settings-rows";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.settings.general;

export type AboutInfo = { version: string | null; projectsDir: string; settingsFile: string };

function Path({ children }: { children: string | undefined }): React.ReactElement {
  return (
    <code className="block truncate font-mono text-muted-foreground text-xs" title={children}>
      {children ?? "…"}
    </code>
  );
}

export function GeneralSection({
  about,
  onClose,
}: {
  about: AboutInfo | null;
  onClose: () => void;
}): React.ReactElement {
  return (
    <>
      <SettingsGroup title={copy.storage}>
        <SettingsRow description={copy.projectsFolderDescription} title={copy.projectsFolder}>
          <Path>{about?.projectsDir}</Path>
        </SettingsRow>
        <SettingsRow description={copy.settingsFileDescription} title={copy.settingsFile}>
          <Path>{about?.settingsFile}</Path>
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup title={copy.onboarding}>
        <SettingsRow
          control={
            <Button onClick={onClose} render={<Link href="/?onboarding" />} size="sm" variant="outline">
              {copy.replayAction}
            </Button>
          }
          description={copy.replayDescription}
          title={copy.replay}
        />
      </SettingsGroup>
    </>
  );
}
