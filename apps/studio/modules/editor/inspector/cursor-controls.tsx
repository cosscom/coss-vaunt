"use client";

import { SegmentedRadio, SegmentedRadioGroup } from "@coss/ui/shared/segmented-radio-group";
import { resolveCursorSettings, setCursorSettings } from "@coss/vaunt-engine/storyboard/cursor-settings";
import { type Clip, CURSOR_STYLES, type Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type * as React from "react";
import { InspectorNumberRow } from "./inspector-number-row";
import { InspectorRow } from "./inspector-row";
import { InspectorSwitchRow } from "./inspector-switch-row";
import { useRecordedCursorPath } from "./use-recorded-cursor-path";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.inspector.cursor;
const SIZE_FORMAT: Intl.NumberFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/** The drawn cursor of a recording clip; recordings made without a cursor path say so instead. */
export function CursorControls({
  project,
  clip,
  onClipChange,
}: {
  project: Project;
  clip: Clip;
  onClipChange: (update: (clip: Clip) => Clip) => void;
}): React.ReactElement | null {
  const hasPath = useRecordedCursorPath(project, clip);
  const settings = resolveCursorSettings(clip);
  if (!settings) return null;
  if (hasPath === false) return <p className="text-muted-foreground text-xs">{copy.noPath}</p>;

  return (
    <>
      <InspectorSwitchRow
        checked={settings.visible}
        label={copy.visible}
        onCheckedChange={(visible) => onClipChange((current) => setCursorSettings(current, { visible }))}
      />
      <InspectorNumberRow
        disabled={!settings.visible}
        format={SIZE_FORMAT}
        label={copy.size}
        max={3}
        min={0.5}
        onChange={(size) => onClipChange((current) => setCursorSettings(current, { size }))}
        step={0.05}
        value={settings.size}
      />
      <InspectorRow label={copy.style}>
        <SegmentedRadioGroup
          aria-label={copy.style}
          className="w-full *:flex-1"
          disabled={!settings.visible}
          onValueChange={(value) => {
            const style = CURSOR_STYLES.find((candidate) => candidate === value);
            if (style) onClipChange((current) => setCursorSettings(current, { style }));
          }}
          size="sm"
          value={settings.style}>
          {CURSOR_STYLES.map((style) => (
            <SegmentedRadio key={style} value={style}>
              {copy.styles[style]}
            </SegmentedRadio>
          ))}
        </SegmentedRadioGroup>
      </InspectorRow>
    </>
  );
}
