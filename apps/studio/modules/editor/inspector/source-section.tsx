"use client";

import {
  type Clip,
  type ClipSource,
  type Project,
  TEXT_ALIGNS,
  TEXT_SIZES,
} from "@calcom/product-video/storyboard/storyboard-schema";
import { Badge } from "@coss/ui/components/badge";
import { SegmentedRadio, SegmentedRadioGroup } from "@coss/ui/shared/segmented-radio-group";
import type * as React from "react";
import { RecordClipButton } from "../recording/record-clip-button";
import type { PageOption } from "../storyboard/page-options";
import { usePageOptions } from "../storyboard/use-page-options";
import { TextEffectPicker } from "../text-effects/text-effect-picker";
import { CursorControls } from "./cursor-controls";
import { DraftTextarea } from "./draft-text-field";
import { InspectorNumberRow } from "./inspector-number-row";
import { InspectorRow } from "./inspector-row";
import { InspectorSection } from "./inspector-section";
import { InspectorSelectRow } from "./inspector-select-row";
import { SECONDS_FORMAT } from "./property-controls";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.inspector;
const sizeItems = TEXT_SIZES.map((size) => ({ value: size, label: STUDIO_COPY.textSizes[size] }));
const MAX_TEXT_LENGTH = 200;

type SourceOf<Kind extends ClipSource["kind"]> = Extract<ClipSource, { kind: Kind }>;

type SourceSectionProps = {
  project: Project;
  clip: Clip;
  onClipChange: (update: (clip: Clip) => Clip) => void;
};

function fileName(file: string): string {
  return file.split("/").pop() ?? file;
}

/** The app's discovered pages, with the clip's own route first so the select always shows it. */
function routeItemsFor(route: string, pages: readonly PageOption[]): Array<{ value: string; label: string }> {
  return [route, ...pages.map((page) => page.path).filter((path) => path !== route)].map((path) => ({
    value: path,
    label: path,
  }));
}

export function SourceSection({ project, clip, onClipChange }: SourceSectionProps): React.ReactElement {
  const { source } = clip;
  const pages = usePageOptions(project.id);
  const updateSource = <Kind extends ClipSource["kind"]>(
    kind: Kind,
    update: (source: SourceOf<Kind>) => SourceOf<Kind>
  ) =>
    onClipChange((current) =>
      current.source.kind === kind
        ? { ...current, source: update(current.source as SourceOf<Kind>) }
        : current
    );

  return (
    <InspectorSection
      aside={
        source.kind === "text" ? undefined : (
          <Badge variant="outline">{STUDIO_COPY.sources[source.kind]}</Badge>
        )
      }
      title={source.kind === "text" ? copy.text : copy.source}>
      {source.kind === "recording" ? (
        <>
          <InspectorSelectRow
            items={routeItemsFor(source.route, pages)}
            label={copy.route}
            onChange={(route) => updateSource("recording", (current) => ({ ...current, route }))}
            value={source.route}
          />
          <RecordClipButton clip={clip} project={project} />
          <CursorControls clip={clip} onClipChange={onClipChange} project={project} />
        </>
      ) : null}

      {source.kind === "import" || source.kind === "image" ? (
        <>
          <InspectorRow label={copy.file}>
            <span className="truncate text-foreground text-xs" title={source.file}>
              {fileName(source.file)}
            </span>
          </InspectorRow>
          <InspectorRow label={copy.resolution}>
            <span className="text-foreground text-xs tabular-nums">
              {source.width} × {source.height}
            </span>
          </InspectorRow>
          {source.kind === "import" ? (
            <InspectorNumberRow
              format={SECONDS_FORMAT}
              label={copy.trimStart}
              max={Math.max(0, source.fileDuration - clip.duration)}
              min={0}
              onChange={(trimStart) => updateSource("import", (current) => ({ ...current, trimStart }))}
              step={0.1}
              value={source.trimStart}
            />
          ) : null}
        </>
      ) : null}

      {source.kind === "text" ? (
        <>
          <InspectorRow htmlFor="clip-words" label={copy.words}>
            <DraftTextarea
              id="clip-words"
              key={clip.id}
              maxLength={MAX_TEXT_LENGTH}
              onCommit={(text) => updateSource("text", (current) => ({ ...current, text }))}
              value={source.text}
            />
          </InspectorRow>
          <InspectorSelectRow
            items={sizeItems}
            label={copy.size}
            onChange={(size) => updateSource("text", (current) => ({ ...current, size }))}
            value={source.size}
          />
          <InspectorSelectRow
            items={STUDIO_COPY.textWeights}
            label={copy.weight}
            onChange={(weight) => updateSource("text", (current) => ({ ...current, weight }))}
            value={source.weight}
          />
          <InspectorRow label={copy.align}>
            <SegmentedRadioGroup
              aria-label={copy.align}
              className="w-full *:flex-1"
              onValueChange={(value) => {
                const align = TEXT_ALIGNS.find((candidate) => candidate === value);
                if (align) updateSource("text", (current) => ({ ...current, align }));
              }}
              size="sm"
              value={source.align}>
              {TEXT_ALIGNS.map((align) => (
                <SegmentedRadio key={align} value={align}>
                  {STUDIO_COPY.textAligns[align]}
                </SegmentedRadio>
              ))}
            </SegmentedRadioGroup>
          </InspectorRow>
          <TextEffectPicker
            label={copy.enter}
            onChange={(effectIn) => updateSource("text", (current) => ({ ...current, effectIn }))}
            previewText={source.text}
            value={source.effectIn}
          />
          <TextEffectPicker
            label={copy.exit}
            onChange={(effectOut) => updateSource("text", (current) => ({ ...current, effectOut }))}
            previewText={source.text}
            value={source.effectOut}
          />
        </>
      ) : null}
    </InspectorSection>
  );
}
