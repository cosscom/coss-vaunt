"use client";

import {
  APP_INSTRUCTIONS_MAX,
  ASPECT_RATIOS,
  type AspectRatio,
} from "@calcom/product-video/storyboard/storyboard-schema";
import { Field, FieldDescription, FieldError, FieldLabel } from "@coss/ui/components/field";
import { Input } from "@coss/ui/components/input";
import { Label } from "@coss/ui/components/label";
import { Radio, RadioGroup } from "@coss/ui/components/radio-group";
import { Switch } from "@coss/ui/components/switch";
import { Textarea } from "@coss/ui/components/textarea";
import { LockIcon } from "@coss/ui/icons";
import type * as React from "react";
import { useState } from "react";
import { cssAspectRatio } from "./css-aspect-ratio";
import { type NewProjectDraft, urlProblem } from "./new-project-draft";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.newProject;

export type DraftFieldProps = { draft: NewProjectDraft; update: (patch: Partial<NewProjectDraft>) => void };

/** Widest first, so the row reads landscape to vertical. */
const ASPECTS = [...ASPECT_RATIOS].reverse();

const OPTION_CARD =
  "group flex cursor-pointer rounded-lg border font-normal transition-[background-color,border-color] duration-150 hover:bg-accent/48 has-data-checked:border-info has-data-checked:bg-info/8 has-focus-visible:ring-2 has-focus-visible:ring-ring";

export function NameField({ draft, update }: DraftFieldProps): React.ReactElement {
  return (
    <Field>
      <FieldLabel>{copy.nameLabel}</FieldLabel>
      <Input
        data-step-focus
        maxLength={120}
        onChange={(event) => update({ name: event.target.value })}
        placeholder={copy.namePlaceholder}
        required
        value={draft.name}
      />
    </Field>
  );
}

export function AspectRatioPicker({ draft, update }: DraftFieldProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-medium text-foreground text-sm">{copy.aspectRatio}</span>
      <RadioGroup
        aria-label={copy.aspectRatio}
        className="grid grid-cols-4 gap-2"
        onValueChange={(value) => {
          const ratio = ASPECTS.find((candidate) => candidate === value);
          if (ratio) update({ aspectRatio: ratio });
        }}
        value={draft.aspectRatio}>
        {ASPECTS.map((ratio: AspectRatio) => (
          <Label className={`${OPTION_CARD} flex-col items-center gap-2 p-2.5`} key={ratio}>
            <Radio className="sr-only" value={ratio} />
            <span aria-hidden="true" className="flex size-9 items-center justify-center">
              <span
                className="max-h-full max-w-full rounded-[3px] border-[1.5px] border-current text-muted-foreground group-has-data-checked:text-info"
                style={{
                  aspectRatio: cssAspectRatio(ratio),
                  height: ratio === "16:9" ? "auto" : "100%",
                  width: ratio === "16:9" ? "100%" : "auto",
                }}
              />
            </span>
            <span className="flex flex-col items-center leading-tight">
              <span className="text-foreground text-xs tabular-nums">{ratio}</span>
              <span className="text-muted-foreground text-xs">{copy.aspectNames[ratio]}</span>
            </span>
          </Label>
        ))}
      </RadioGroup>
    </div>
  );
}

function AddressField({
  value,
  onChange,
  placeholder,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hint: string;
}): React.ReactElement {
  // Judged once the field is left, then on every change, so a half-typed address isn't called wrong.
  const [touched, setTouched] = useState(false);
  const invalid = touched && urlProblem(value);
  return (
    <Field invalid={invalid}>
      <FieldLabel>{copy.addressLabel}</FieldLabel>
      <Input
        autoComplete="off"
        data-step-focus
        inputMode="url"
        onBlur={() => setTouched(true)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        type="url"
        value={value}
      />
      {invalid ? (
        <FieldError match>{copy.addressInvalid}</FieldError>
      ) : (
        <FieldDescription>{hint}</FieldDescription>
      )}
    </Field>
  );
}

/** The app's address, what the AI should know about it and how to sign in. */
export function AppDetails({
  draft,
  update,
  defaultAppUrl,
}: DraftFieldProps & { defaultAppUrl: string }): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <AddressField
        hint={copy.addressHint}
        onChange={(url) => update({ url })}
        placeholder={defaultAppUrl}
        value={draft.url}
      />
      <Field>
        <FieldLabel>{copy.instructionsLabel}</FieldLabel>
        <Textarea
          className="max-h-40"
          maxLength={APP_INSTRUCTIONS_MAX}
          onChange={(event) => update({ instructions: event.target.value })}
          placeholder={copy.instructionsPlaceholder}
          rows={3}
          value={draft.instructions}
        />
        <FieldDescription>{copy.instructionsHint}</FieldDescription>
      </Field>
      <div className="flex flex-col gap-3 rounded-lg border p-3">
        <Label className="flex cursor-pointer items-center justify-between gap-3 font-normal">
          <span className="flex items-center gap-2 text-foreground text-sm">
            <LockIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            {copy.signIn}
          </span>
          <Switch checked={draft.signIn} onCheckedChange={(signIn) => update({ signIn })} />
        </Label>
        {draft.signIn ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{copy.usernameLabel}</FieldLabel>
                <Input
                  autoComplete="off"
                  data-1p-ignore
                  onChange={(event) => update({ username: event.target.value })}
                  spellCheck={false}
                  value={draft.username}
                />
              </Field>
              <Field>
                <FieldLabel>{copy.passwordLabel}</FieldLabel>
                <Input
                  autoComplete="off"
                  data-1p-ignore
                  onChange={(event) => update({ password: event.target.value })}
                  type="password"
                  value={draft.password}
                />
              </Field>
            </div>
            <p className="text-muted-foreground text-xs">{copy.loginHint}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
