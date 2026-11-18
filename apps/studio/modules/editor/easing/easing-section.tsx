"use client";

import { setVolumeKeyframeEase, updateAudioClip } from "@calcom/product-video/audio/audio-edits";
import { easeToCubic, sameCurve } from "@calcom/product-video/storyboard/keyframe-ease";
import { applyEase } from "@calcom/product-video/storyboard/property-evaluation";
import type { Ease } from "@calcom/product-video/storyboard/storyboard-schema";
import { Button } from "@coss/ui/components/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@coss/ui/components/collapsible";
import { ChevronDownIcon, PlayIcon } from "@coss/ui/icons";
import type * as React from "react";
import { useState } from "react";
import { audioSelectionFor, pruneAudioSelection, useAudioSelection } from "../audio/audio-selection";
import type { PlaybackClock } from "../player/playback-clock";
import type { EditorState } from "../use-editor-state";
import { CubicBezierInput } from "./cubic-bezier-input";
import { CurveEditor } from "./curve-editor";
import { PLOT_Y_MAX, PLOT_Y_MIN } from "./curve-plot";
import { EasePresetGrid } from "./ease-preset-grid";
import { EASING_COPY as copy, easeLabel } from "./easing-copy";
import { easingTarget, easingTargetKey, summariseEases } from "./easing-target";
import { useEasePreview } from "./use-ease-preview";

const STROBE = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
const trackPercent = (value: number) =>
  `${((Math.min(PLOT_Y_MAX, Math.max(PLOT_Y_MIN, value)) - PLOT_Y_MIN) / (PLOT_Y_MAX - PLOT_Y_MIN)) * 100}%`;

function EasePreview({
  ease,
  label,
  disabled,
  time,
  onPlay,
}: {
  ease: Ease;
  label: string;
  disabled: boolean;
  time: number | null;
  onPlay: () => void;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <Button
        aria-label={copy.play(label)}
        className="min-w-0 max-w-[45%] justify-start"
        disabled={disabled}
        onClick={onPlay}
        size="xs"
        variant="outline">
        <PlayIcon aria-hidden="true" />
        <span className="truncate">{label}</span>
      </Button>
      <div aria-hidden="true" className="relative h-4 min-w-0 flex-1">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        {[0, 1].map((edge) => (
          <div
            className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-muted-foreground/48"
            key={edge}
            style={{ left: trackPercent(edge) }}
          />
        ))}
        {STROBE.map((t) => (
          <div
            className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/40"
            key={t}
            style={{ left: trackPercent(applyEase(ease, t)) }}
          />
        ))}
        {time === null ? null : (
          <div
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
            style={{ left: trackPercent(applyEase(ease, time)) }}
          />
        )}
      </div>
    </div>
  );
}

/** Edits the ease of every selected keyframe, video or volume, from the bottom of the left sidebar. */
export function EasingSection({
  editor,
  clock,
}: {
  editor: EditorState;
  clock: PlaybackClock;
}): React.ReactElement {
  const { project } = editor;
  const audioSelection = pruneAudioSelection(useAudioSelection(audioSelectionFor(clock)), project);
  const target = easingTarget(project, editor.selection, audioSelection);
  const summary = target ? summariseEases(target.eases) : null;
  const preview = useEasePreview();
  const ease: Ease = summary?.ease ?? "linear";
  const cubic = easeToCubic(ease);
  const disabled = summary === null;
  const label = easeLabel(ease);

  const apply = (next: Ease, group?: string) => {
    if (!target || target.eases.every((current) => sameCurve(current, next))) return;
    if (target.kind === "video") {
      editor.setKeyframesEase(target.clipId, target.refs, next, group);
      return;
    }
    editor.edit(
      (current) =>
        updateAudioClip(current, target.clipId, (clip) =>
          setVolumeKeyframeEase(clip, target.keyframeIds, next)
        ),
      group
    );
  };

  // Open only while keyframes are selected; a manual toggle holds until the selection changes.
  const targetKey = easingTargetKey(target);
  const [override, setOverride] = useState<{ key: string; open: boolean } | null>(null);
  const open = override?.key === targetKey ? override.open : target !== null;

  const previewPoint =
    preview.time === null || disabled ? null : { x: preview.time, y: applyEase(ease, preview.time) };

  return (
    <Collapsible
      className="mt-auto shrink-0 border-t"
      onOpenChange={(next) => setOverride({ key: targetKey, open: next })}
      open={open}>
      <CollapsibleTrigger className="group flex h-10 w-full cursor-pointer items-center gap-2 px-4 text-start outline-none hover:bg-accent/40 focus-visible:bg-accent/60">
        <span className="flex-1 font-medium text-foreground text-sm">{copy.title}</span>
        {summary ? (
          <span className="truncate text-muted-foreground text-xs">{summary.mixed ? copy.mixed : label}</span>
        ) : null}
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 -rotate-90 text-muted-foreground transition-transform group-data-panel-open:rotate-0"
        />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="flex flex-col gap-3 px-4 pt-1 pb-4">
          {disabled ? (
            <div className="flex flex-col gap-0.5 text-xs">
              <p className="text-foreground">{copy.empty}</p>
              <p className="text-muted-foreground">{copy.hint}</p>
            </div>
          ) : null}
          <CurveEditor
            disabled={disabled}
            onChange={(points, group) => apply({ cubic: points }, group)}
            points={cubic}
            preview={previewPoint}
          />
          <EasePreview
            disabled={disabled}
            ease={ease}
            label={summary?.mixed ? copy.mixed : label}
            onPlay={preview.play}
            time={disabled ? null : preview.time}
          />
          <CubicBezierInput
            disabled={disabled}
            key={`${disabled}:${cubic?.join(",") ?? "hold"}`}
            onCommit={(points) => apply({ cubic: points })}
            value={disabled ? null : cubic}
          />
          <EasePresetGrid
            disabled={disabled}
            ease={ease}
            key={targetKey}
            mixed={summary?.mixed ?? false}
            onPick={apply}
          />
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
