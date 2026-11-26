"use client";

import { Button } from "@coss/ui/components/button";
import { Slider } from "@coss/ui/components/slider";
import { Switch } from "@coss/ui/components/switch";
import Link from "next/link";
import type * as React from "react";
import { useSettings } from "./settings-provider";
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
  const { editorPreferences, updateEditorPreferences, previewEditorPreferences } = useSettings();
  return (
    <>
      <SettingsGroup title={copy.editor}>
        <SettingsRow
          control={
            <Switch
              aria-label={copy.hoverSelect}
              checked={editorPreferences.hoverSelect}
              onCheckedChange={(hoverSelect) => void updateEditorPreferences({ hoverSelect })}
            />
          }
          description={copy.hoverSelectDescription}
          title={copy.hoverSelect}
        />
        <SettingsRow
          control={
            <div className="flex w-56 items-center gap-3">
              <Slider
                aria-label={copy.hoverDelay}
                disabled={!editorPreferences.hoverSelect}
                max={3000}
                min={150}
                onValueChange={(value) => previewEditorPreferences({ hoverSelectDelayMs: value as number })}
                onValueCommitted={(value) =>
                  void updateEditorPreferences({ hoverSelectDelayMs: value as number })
                }
                step={50}
                value={editorPreferences.hoverSelectDelayMs}
              />
              <span className="w-10 text-end text-muted-foreground text-xs tabular-nums">
                {copy.seconds(editorPreferences.hoverSelectDelayMs)}
              </span>
            </div>
          }
          description={copy.hoverDelayDescription}
          title={copy.hoverDelay}
        />
      </SettingsGroup>
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
            <Button onClick={onClose} render={<Link href="/?onboarding" />} size="sm" variant="secondary">
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
