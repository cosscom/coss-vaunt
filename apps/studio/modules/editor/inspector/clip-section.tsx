"use client";

import { cn } from "@coss/ui/lib/utils";
import {
  findClipLocation,
  incomingOverlap,
  MIN_CLIP_SECONDS,
  maxClipDuration,
  setClipDuration,
  setClipStart,
  updateClip,
} from "@coss/vaunt-engine/storyboard/storyboard-edits";
import {
  type Clip,
  MAX_RECORDING_SECONDS,
  type Project,
  TRANSITION_KINDS,
} from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type * as React from "react";
import { useEffect, useRef } from "react";
import { DraftInput } from "./draft-text-field";
import { InspectorNumberRow } from "./inspector-number-row";
import { InspectorRow } from "./inspector-row";
import { InspectorSection } from "./inspector-section";
import { InspectorSelectRow } from "./inspector-select-row";
import { SECONDS_FORMAT } from "./property-controls";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.inspector;
const transitionItems = TRANSITION_KINDS.map((kind) => ({
  value: kind,
  label: STUDIO_COPY.transitions[kind],
}));
const MAX_START_SECONDS = 600;

type ClipSectionProps = {
  project: Project;
  clip: Clip;
  focusTransition: boolean;
  onEdit: (update: (project: Project) => Project) => void;
};

export function ClipSection({
  project,
  clip,
  focusTransition,
  onEdit,
}: ClipSectionProps): React.ReactElement {
  const transitionRef = useRef<HTMLDivElement>(null);
  const location = findClipLocation(project, clip.id);
  const overlap = location ? incomingOverlap(location.track, clip.id) : 0;
  const capped = clip.source.kind === "recording";

  useEffect(() => {
    if (focusTransition) transitionRef.current?.scrollIntoView({ block: "nearest" });
  }, [focusTransition]);

  return (
    <InspectorSection aside={location?.track.name} defaultOpen={false} title={copy.clip}>
      <InspectorRow htmlFor="clip-name" label={copy.name}>
        <DraftInput
          id="clip-name"
          key={clip.id}
          maxLength={80}
          onCommit={(name) =>
            onEdit((current) => updateClip(current, clip.id, (next) => ({ ...next, name })))
          }
          value={clip.name}
        />
      </InspectorRow>
      <InspectorNumberRow
        format={SECONDS_FORMAT}
        label={copy.start}
        max={MAX_START_SECONDS}
        min={0}
        onChange={(start) => onEdit((current) => setClipStart(current, clip.id, start))}
        sliderRange={null}
        step={0.1}
        value={clip.start}
      />
      <InspectorNumberRow
        format={SECONDS_FORMAT}
        hint={capped ? copy.durationCap(MAX_RECORDING_SECONDS) : undefined}
        label={copy.duration}
        max={maxClipDuration(clip)}
        min={MIN_CLIP_SECONDS}
        onChange={(duration) => onEdit((current) => setClipDuration(current, clip.id, duration))}
        sliderRange={null}
        step={0.1}
        value={clip.duration}
      />
      <div
        className={cn(
          "-mx-2 flex flex-col gap-1 rounded-lg px-2 py-1 transition-colors",
          focusTransition && overlap > 0 && "bg-accent"
        )}
        data-testid="transition-row"
        ref={transitionRef}>
        <InspectorSelectRow
          disabled={overlap === 0}
          items={transitionItems}
          label={copy.transition}
          onChange={(transitionIn) =>
            onEdit((current) => updateClip(current, clip.id, (next) => ({ ...next, transitionIn })))
          }
          value={clip.transitionIn}
        />
        {overlap > 0 ? (
          <p className="ps-26 text-muted-foreground text-xs tabular-nums">
            {copy.transitionLength(`${overlap.toFixed(2)} s`)}
          </p>
        ) : null}
      </div>
    </InspectorSection>
  );
}
