"use client";

import { SegmentedRadio, SegmentedRadioGroup } from "@coss/ui/shared/segmented-radio-group";
import {
  setAudioFade,
  setAudioTrimStart,
  setVolumeAt,
  toggleVolumeKeyframeAt,
} from "@coss/vaunt-engine/audio/audio-edits";
import { evaluateProperty } from "@coss/vaunt-engine/storyboard/property-evaluation";
import { MIN_CLIP_SECONDS } from "@coss/vaunt-engine/storyboard/storyboard-edits";
import { type AudioClip, MAX_AUDIO_FADE_SECONDS } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type * as React from "react";
import { DraftInput } from "../inspector/draft-text-field";
import { InspectorNumberRow } from "../inspector/inspector-number-row";
import { InspectorRow } from "../inspector/inspector-row";
import { InspectorSection } from "../inspector/inspector-section";
import { keyframeState } from "../inspector/keyframe-state";
import { AUDIO_COPY } from "./audio-copy";

const copy = AUDIO_COPY.inspector;
const SECONDS: Intl.NumberFormatOptions = { maximumFractionDigits: 2 };
const PERCENT: Intl.NumberFormatOptions = { style: "percent", maximumFractionDigits: 0 };

type AudioClipInspectorProps = {
  clip: AudioClip;
  /** Project time; the volume shown and keyframed is the one there. */
  playheadTime: number;
  onChange: (clip: AudioClip) => void;
};

export function AudioClipInspector({
  clip,
  playheadTime,
  onChange,
}: AudioClipInspectorProps): React.ReactElement {
  const local = Math.min(clip.duration, Math.max(0, playheadTime - clip.start));
  return (
    <InspectorSection title={copy.title}>
      <InspectorRow htmlFor="audio-clip-name" label={copy.name}>
        <DraftInput
          id="audio-clip-name"
          key={clip.id}
          maxLength={80}
          onCommit={(name) => onChange({ ...clip, name: name.trim() })}
          value={clip.name}
        />
      </InspectorRow>
      <InspectorRow label={copy.kind}>
        <SegmentedRadioGroup
          aria-label={copy.kind}
          className="w-full"
          onValueChange={(kind) => {
            if (kind === "music" || kind === "sfx") onChange({ ...clip, kind });
          }}
          size="sm"
          value={clip.kind}>
          <SegmentedRadio value="music">{copy.music}</SegmentedRadio>
          <SegmentedRadio value="sfx">{copy.sfx}</SegmentedRadio>
        </SegmentedRadioGroup>
      </InspectorRow>
      <InspectorNumberRow
        format={PERCENT}
        keyframe={{
          state: keyframeState(clip.volume, local),
          onToggle: () => onChange(toggleVolumeKeyframeAt(clip, local)),
        }}
        label={copy.volume}
        max={1}
        min={0}
        onChange={(value) => onChange(setVolumeAt(clip, local, value))}
        step={0.01}
        value={evaluateProperty(clip.volume, local)}
      />
      <InspectorNumberRow
        format={SECONDS}
        label={copy.fadeIn}
        max={MAX_AUDIO_FADE_SECONDS}
        min={0}
        onChange={(value) => onChange(setAudioFade(clip, "in", value))}
        step={0.1}
        value={clip.fadeIn}
      />
      <InspectorNumberRow
        format={SECONDS}
        label={copy.fadeOut}
        max={MAX_AUDIO_FADE_SECONDS}
        min={0}
        onChange={(value) => onChange(setAudioFade(clip, "out", value))}
        step={0.1}
        value={clip.fadeOut}
      />
      <InspectorNumberRow
        format={SECONDS}
        label={copy.trimStart}
        max={Math.max(0, clip.fileDuration - MIN_CLIP_SECONDS)}
        min={0}
        onChange={(value) => onChange(setAudioTrimStart(clip, value))}
        sliderRange={null}
        step={0.1}
        value={clip.trimStart}
      />
    </InspectorSection>
  );
}
