"use client";

import {
  blurPropertyKeys,
  resetBlur,
  resolveBlurSettings,
  setBlurSettings,
} from "@calcom/product-video/storyboard/blur-settings";
import {
  BLUR_FOCUS_MODES,
  BLUR_MODES,
  type BlurSettings,
  type Clip,
} from "@calcom/product-video/storyboard/storyboard-schema";
import { Button } from "@coss/ui/components/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { RotateCcwIcon } from "@coss/ui/icons";
import { SegmentedRadio, SegmentedRadioGroup } from "@coss/ui/shared/segmented-radio-group";
import type * as React from "react";
import { useRef } from "react";
import type { PlaybackClock } from "../player/playback-clock";
import type { EditorState } from "../use-editor-state";
import { InspectorRow } from "./inspector-row";
import { InspectorSwitchRow } from "./inspector-switch-row";
import { PropertyGroupSection } from "./property-group-section";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.inspector.blur;

/** Hovering or focusing the section counts as editing blur, so the stage shows its guides. */
export function BlurSection({
  clip,
  clock,
  editor,
  onEditingChange,
}: {
  clip: Clip;
  clock: PlaybackClock;
  editor: EditorState;
  onEditingChange: (editing: boolean) => void;
}): React.ReactElement {
  const settings = resolveBlurSettings(clip);
  const engaged = useRef({ pointer: false, focus: false });
  const engage = (change: Partial<typeof engaged.current>) => {
    engaged.current = { ...engaged.current, ...change };
    onEditingChange(engaged.current.pointer || engaged.current.focus);
  };
  const change = (next: Partial<BlurSettings>) =>
    editor.editClip(clip.id, (current) => setBlurSettings(current, next));

  return (
    <div
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) engage({ focus: false });
      }}
      onFocus={() => engage({ focus: true })}
      onPointerEnter={() => engage({ pointer: true })}
      onPointerLeave={() => engage({ pointer: false })}>
      <PropertyGroupSection
        action={
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={copy.reset}
                  onClick={() => editor.editClip(clip.id, resetBlur)}
                  size="icon-xs"
                  variant="ghost"
                />
              }>
              <RotateCcwIcon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipPopup>{copy.reset}</TooltipPopup>
          </Tooltip>
        }
        clip={clip}
        clock={clock}
        editor={editor}
        group="blur"
        keys={settings.enabled ? blurPropertyKeys(settings) : []}
        title={copy.title}>
        <InspectorSwitchRow
          checked={settings.enabled}
          label={copy.enabled}
          onCheckedChange={(enabled) => change({ enabled })}
        />
        {settings.enabled ? (
          <>
            <SegmentedRadioGroup
              aria-label={copy.mode}
              className="w-full *:flex-1"
              onValueChange={(next) => {
                const mode = BLUR_MODES.find((candidate) => candidate === next);
                if (mode) change({ mode });
              }}
              size="sm"
              value={settings.mode}>
              {BLUR_MODES.map((mode) => (
                <SegmentedRadio key={mode} value={mode}>
                  {copy.modes[mode]}
                </SegmentedRadio>
              ))}
            </SegmentedRadioGroup>
            {settings.mode === "lens" ? (
              <InspectorRow label={copy.focus}>
                <SegmentedRadioGroup
                  aria-label={copy.focus}
                  className="w-full *:flex-1"
                  onValueChange={(next) => {
                    const focus = BLUR_FOCUS_MODES.find((candidate) => candidate === next);
                    if (focus) change({ focus });
                  }}
                  size="sm"
                  value={settings.focus}>
                  {BLUR_FOCUS_MODES.map((focus) => (
                    <SegmentedRadio key={focus} value={focus}>
                      {copy.focusModes[focus]}
                    </SegmentedRadio>
                  ))}
                </SegmentedRadioGroup>
              </InspectorRow>
            ) : null}
          </>
        ) : null}
      </PropertyGroupSection>
    </div>
  );
}
