"use client";

import { SegmentedControl, SegmentedControlItem } from "@coss/ui/components/segmented-control";
import { Slider } from "@coss/ui/components/slider";
import { Switch } from "@coss/ui/components/switch";
import { MonitorIcon, MoonIcon, SunIcon } from "@coss/ui/icons";
import { useTheme } from "next-themes";
import type * as React from "react";
import { useEffect, useState } from "react";
import { useSettings } from "./settings-provider";
import { SettingsGroup, SettingsRow } from "./settings-rows";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.settings.appearance;
const THEMES = [
  { value: "system", Icon: MonitorIcon },
  { value: "light", Icon: SunIcon },
  { value: "dark", Icon: MoonIcon },
] as const;

export function AppearanceSection(): React.ReactElement {
  const { theme, setTheme } = useTheme();
  const { appearance, glassCapable, updateAppearance, previewAppearance } = useSettings();
  // next-themes only knows the theme on the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? (theme ?? "system") : null;

  return (
    <>
      <SettingsGroup title={copy.theme}>
        <SettingsRow
          control={
            <SegmentedControl aria-label={copy.themeTitle} role="radiogroup" size="sm">
              {THEMES.map(({ value, Icon }) => (
                <SegmentedControlItem
                  aria-checked={current === value}
                  data-checked={current === value ? "" : undefined}
                  key={value}
                  onClick={() => setTheme(value)}
                  role="radio">
                  <Icon aria-hidden="true" />
                  {copy.themes[value]}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          }
          description={copy.themeDescription}
          title={copy.themeTitle}
        />
      </SettingsGroup>
      <SettingsGroup title={copy.window}>
        <SettingsRow
          control={
            <Switch
              aria-label={copy.glass}
              checked={glassCapable && appearance.glass}
              disabled={!glassCapable}
              onCheckedChange={(glass) => void updateAppearance({ glass })}
            />
          }
          description={glassCapable ? copy.glassDescription : copy.glassUnavailable}
          title={copy.glass}
        />
        <SettingsRow
          control={
            <div className="flex w-56 items-center gap-3">
              <Slider
                aria-label={copy.tint}
                disabled={!glassCapable || !appearance.glass}
                max={100}
                min={0}
                onValueChange={(value) => previewAppearance({ tint: value as number })}
                onValueCommitted={(value) => void updateAppearance({ tint: value as number })}
                value={appearance.tint}
              />
              <span className="w-9 text-end text-muted-foreground text-xs tabular-nums">
                {Math.round(appearance.tint)}%
              </span>
            </div>
          }
          description={copy.tintDescription}
          title={copy.tint}
        />
      </SettingsGroup>
    </>
  );
}
