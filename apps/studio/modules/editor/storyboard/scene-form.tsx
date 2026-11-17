"use client";

import {
  findRouteEntry,
  isAppPath,
  ROUTE_CATALOGUE,
} from "@calcom/product-video/catalogues/routes/route-catalogue";
import { listTextEffects } from "@calcom/product-video/catalogues/text-effects/text-effect-catalogue";
import { ACCEPTED_MEDIA } from "@calcom/product-video/imports/media-types";
import type { FileAsset } from "@calcom/product-video/project-store/project-assets";
import { type BoardNode, RECORDING_START_MODES } from "@calcom/product-video/storyboard/board-schema";
import { MAX_CLIP_SECONDS, MAX_RECORDING_SECONDS } from "@calcom/product-video/storyboard/storyboard-schema";
import { Alert, AlertDescription, AlertTitle } from "@coss/ui/components/alert";
import { Button } from "@coss/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@coss/ui/components/field";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@coss/ui/components/number-field";
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@coss/ui/components/select";
import { CircleAlertIcon, UploadIcon } from "@coss/ui/icons";
import { SegmentedRadio, SegmentedRadioGroup } from "@coss/ui/shared/segmented-radio-group";
import type * as React from "react";
import { useRef, useState } from "react";
import { DraftInput, DraftTextarea } from "../inspector/draft-text-field";
import { groupTextEffects } from "../text-effects/text-effect-groups";
import type { NodeGeneration } from "./generation-stream";
import { fileLabel } from "./scene-node";
import type { StoryboardActions } from "./use-storyboard-actions";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.storyboard.form;
const AGENT_PICKS = "agent";
const OTHER_PAGE = "other";
const MAX_TITLE_LENGTH = 80;
const MAX_NOTES_LENGTH = 2000;
const MAX_WORDS_LENGTH = 280;
const MAX_PATH_LENGTH = 300;

type SceneOf<Kind extends BoardNode["kind"]> = Extract<BoardNode, { kind: Kind }>;

type SceneFormProps = {
  node: BoardNode;
  actions: StoryboardActions;
  /** Imported video and images a media scene can use. */
  files: readonly FileAsset[];
  onUpload: (files: File[]) => Promise<string | null>;
  uploading: boolean;
  /** The scene's last generation, so a failure shows in full; the canvas node only has room for a line. */
  generation?: NodeGeneration;
};

export function SceneForm({
  node,
  actions,
  files,
  onUpload,
  uploading,
  generation,
}: SceneFormProps): React.ReactElement {
  const fileInput = useRef<HTMLInputElement>(null);
  const update = <Kind extends BoardNode["kind"]>(
    kind: Kind,
    change: (scene: SceneOf<Kind>) => SceneOf<Kind>,
    group?: string
  ) =>
    actions.updateNode(
      node.id,
      (current) => (current.kind === kind ? change(current as SceneOf<Kind>) : current),
      group
    );
  const updateAny = (change: (scene: BoardNode) => BoardNode, group?: string) =>
    actions.updateNode(node.id, change, group);
  const maxDuration = node.kind === "recording" ? MAX_RECORDING_SECONDS : MAX_CLIP_SECONDS;
  const id = (field: string) => `scene-${node.id}-${field}`;

  return (
    <div className="flex flex-col gap-4">
      {generation?.status === "failed" ? (
        <Alert variant="error">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{copy.generationFailed}</AlertTitle>
          {generation.message ? (
            <AlertDescription className="whitespace-pre-wrap break-words">
              {generation.message}
            </AlertDescription>
          ) : null}
        </Alert>
      ) : null}
      <Field>
        <FieldLabel htmlFor={id("title")}>{copy.title}</FieldLabel>
        <DraftInput
          id={id("title")}
          maxLength={MAX_TITLE_LENGTH}
          onCommit={(title) => updateAny((current) => ({ ...current, title }), `scene-title:${node.id}`)}
          value={node.title}
        />
      </Field>

      {node.kind === "recording" ? (
        <>
          <RouteField
            id={id("route")}
            onChange={(route) => update("recording", (current) => ({ ...current, route }))}
            route={node.route}
          />
          <Field>
            <FieldLabel>{copy.startFrom}</FieldLabel>
            <SegmentedRadioGroup
              aria-label={copy.startFrom}
              className="w-full *:flex-1"
              onValueChange={(value) => {
                const startFrom = RECORDING_START_MODES.find((mode) => mode === value);
                if (startFrom) update("recording", (current) => ({ ...current, startFrom }));
              }}
              size="sm"
              value={node.startFrom}>
              <SegmentedRadio value="fresh">{copy.fresh}</SegmentedRadio>
              <SegmentedRadio value="previous">{copy.previous}</SegmentedRadio>
            </SegmentedRadioGroup>
          </Field>
        </>
      ) : null}

      {node.kind === "text" ? (
        <>
          <Field>
            <FieldLabel htmlFor={id("words")}>{copy.words}</FieldLabel>
            <DraftTextarea
              allowEmpty
              id={id("words")}
              maxLength={MAX_WORDS_LENGTH}
              onCommit={(words) =>
                update("text", (current) => ({ ...current, words }), `scene-words:${node.id}`)
              }
              value={node.words}
            />
          </Field>
          <EffectField
            effect={node.effect}
            onChange={(effect) => update("text", (current) => ({ ...current, effect }))}
          />
        </>
      ) : null}

      {node.kind === "media" ? (
        <Field>
          <FieldLabel>{copy.file}</FieldLabel>
          <div className="flex w-full gap-2">
            <Select
              items={files.map((file) => ({ value: file.file, label: file.name }))}
              onValueChange={(file: string | null) =>
                file && update("media", (current) => ({ ...current, file }))
              }
              value={node.file ?? null}>
              <SelectTrigger className="min-w-0 flex-1" size="sm">
                <SelectValue placeholder={copy.chooseFile}>
                  {(value: string | null) => (value ? fileLabel(value) : copy.chooseFile)}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {files.map((file) => (
                  <SelectItem key={file.file} value={file.file}>
                    {file.name}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <Button
              aria-label={copy.upload}
              loading={uploading}
              onClick={() => fileInput.current?.click()}
              size="icon-sm"
              variant="outline">
              <UploadIcon aria-hidden="true" />
            </Button>
            <input
              accept={ACCEPTED_MEDIA}
              className="hidden"
              onChange={async (event) => {
                const picked = [...(event.target.files ?? [])];
                event.target.value = "";
                const file = await onUpload(picked);
                if (file) update("media", (current) => ({ ...current, file }));
              }}
              ref={fileInput}
              type="file"
            />
          </div>
        </Field>
      ) : null}

      <Field>
        <FieldLabel htmlFor={id("notes")}>{copy.notes}</FieldLabel>
        <DraftTextarea
          allowEmpty
          id={id("notes")}
          maxLength={MAX_NOTES_LENGTH}
          onCommit={(notes) => updateAny((current) => ({ ...current, notes }), `scene-notes:${node.id}`)}
          placeholder={copy.notesPlaceholder}
          value={node.notes}
        />
      </Field>

      <Field>
        <FieldLabel>{copy.duration}</FieldLabel>
        <NumberField
          format={{ style: "unit", unit: "second", unitDisplay: "narrow", maximumFractionDigits: 2 }}
          max={maxDuration}
          min={0.5}
          onValueChange={(duration) =>
            duration !== null &&
            duration > 0 &&
            updateAny((current) => ({ ...current, duration }), `scene-duration:${node.id}`)
          }
          size="sm"
          step={0.5}
          value={node.duration}>
          <NumberFieldGroup>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldGroup>
        </NumberField>
        {node.kind === "recording" ? (
          <FieldDescription>{copy.durationCap(maxDuration)}</FieldDescription>
        ) : null}
      </Field>
    </div>
  );
}

/** A tuned page from the catalogue, or any other path in the app. */
function RouteField({
  id,
  route,
  onChange,
}: {
  id: string;
  route: string;
  onChange: (route: string) => void;
}): React.ReactElement {
  const [other, setOther] = useState(findRouteEntry(route) === null);
  const valid = isAppPath(route);
  const items = [
    ...ROUTE_CATALOGUE.map((entry) => ({ value: entry.route, label: entry.label })),
    { value: OTHER_PAGE, label: copy.otherPage },
  ];
  return (
    <Field invalid={!valid}>
      <FieldLabel htmlFor={other ? id : undefined}>{copy.route}</FieldLabel>
      <Select
        items={items}
        onValueChange={(next: string | null) => {
          if (next === OTHER_PAGE) setOther(true);
          else if (next) {
            setOther(false);
            onChange(next);
          }
        }}
        value={other ? OTHER_PAGE : route}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
      {other ? (
        <DraftInput
          id={id}
          maxLength={MAX_PATH_LENGTH}
          onCommit={(next) => onChange(next.trim())}
          placeholder={copy.pathPlaceholder}
          value={route}
        />
      ) : null}
      {valid ? null : <FieldError match>{copy.notAPath}</FieldError>}
    </Field>
  );
}

function EffectField({
  effect,
  onChange,
}: {
  effect: string | undefined;
  onChange: (effect: string | undefined) => void;
}): React.ReactElement {
  const effects = listTextEffects();
  const groups = groupTextEffects(effects);
  const items = [
    { value: AGENT_PICKS, label: copy.agentPicks },
    ...effects.map((candidate) => ({ value: candidate.id, label: candidate.displayName })),
  ];
  return (
    <Field>
      <FieldLabel>{copy.effect}</FieldLabel>
      <Select
        items={items}
        onValueChange={(next: string | null) =>
          onChange(next === null || next === AGENT_PICKS ? undefined : next)
        }
        value={effect ?? AGENT_PICKS}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup alignItemWithTrigger={false}>
          <SelectItem value={AGENT_PICKS}>{copy.agentPicks}</SelectItem>
          {groups.map((group) => (
            <SelectGroup key={group.target}>
              <SelectGroupLabel>{STUDIO_COPY.textEffects.groups[group.target]}</SelectGroupLabel>
              {group.effects.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.displayName}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectPopup>
      </Select>
    </Field>
  );
}
