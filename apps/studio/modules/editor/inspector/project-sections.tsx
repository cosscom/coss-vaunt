"use client";

import type { ProjectSettings } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type * as React from "react";
import { BackgroundPicker } from "./background-picker";
import { InspectorNumberRow } from "./inspector-number-row";
import { InspectorSection } from "./inspector-section";
import { InspectorSwitchRow } from "./inspector-switch-row";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.inspector;
const percent: Intl.NumberFormatOptions = { style: "percent", maximumFractionDigits: 0 };

type ProjectSectionsProps = {
  settings: ProjectSettings;
  onSettingsChange: (settings: Partial<ProjectSettings>) => void;
};

export function ProjectSections({ settings, onSettingsChange }: ProjectSectionsProps): React.ReactElement {
  const setDevice = (device: Partial<ProjectSettings["device"]>) =>
    onSettingsChange({ device: { ...settings.device, ...device } });

  return (
    <>
      <InspectorSection title={copy.background}>
        <BackgroundPicker
          onChange={(background) => onSettingsChange({ background })}
          value={settings.background}
        />
      </InspectorSection>
      <InspectorSection title={copy.device}>
        <InspectorNumberRow
          label={copy.cornerRadius}
          max={64}
          min={0}
          onChange={(cornerRadius) => setDevice({ cornerRadius })}
          step={1}
          value={settings.device.cornerRadius}
        />
        <InspectorNumberRow
          format={percent}
          label={copy.reflection}
          max={1}
          min={0}
          onChange={(reflection) => setDevice({ reflection })}
          step={0.01}
          value={settings.device.reflection}
        />
        <InspectorSwitchRow
          checked={settings.device.contactShadow}
          label={copy.contactShadow}
          onCheckedChange={(contactShadow) => setDevice({ contactShadow })}
        />
        <InspectorSwitchRow
          checked={settings.device.plinth}
          label={copy.plinth}
          onCheckedChange={(plinth) => setDevice({ plinth })}
        />
      </InspectorSection>
    </>
  );
}
