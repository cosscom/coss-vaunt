"use client";

import { Button } from "@coss/ui/components/button";
import { Dialog, DialogPopup, DialogTitle } from "@coss/ui/components/dialog";
import { Form } from "@coss/ui/components/form";
import { CheckIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useState } from "react";
import { cssAspectRatio } from "./css-aspect-ratio";
import {
  draftInput,
  draftReady,
  draftUrl,
  initialDraft,
  type NewProjectDraft,
  type NewProjectInput,
} from "./new-project-draft";
import { AppChoiceList, AppDetails, AspectRatioPicker, NameField } from "./new-project-fields";
import { StepDissolve } from "./step-dissolve";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.newProject;

function sourceLine(draft: NewProjectDraft): string {
  const title = copy.apps[draft.app].title;
  if (draft.app === "none") return title;
  try {
    return `${title} · ${new URL(draftUrl(draft)).host}`;
  } catch {
    return title;
  }
}

/** The project card as it will look on the projects page, filled in as the form is. */
function CardPreview({ draft, step }: { draft: NewProjectDraft; step: number }): React.ReactElement {
  const name = draft.name.trim();
  return (
    <div
      aria-hidden="true"
      className="flex w-full flex-col overflow-hidden rounded-xl border bg-card shadow-xs/5">
      <div className="relative aspect-[16/10] border-b bg-muted/72">
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="h-[64%] rounded-sm bg-[#0b0b0c] shadow-md/10 ring-1 ring-foreground/8"
            style={{ aspectRatio: cssAspectRatio(draft.aspectRatio) }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate font-medium text-sm",
              name ? "text-foreground" : "text-muted-foreground"
            )}>
            {name || copy.untitled}
          </span>
          <span className="rounded-sm border px-1 text-[0.6875rem] text-muted-foreground tabular-nums">
            {draft.aspectRatio}
          </span>
        </div>
        <span className="truncate text-muted-foreground text-xs">
          {step === 0 ? copy.justNow : sourceLine(draft)}
        </span>
      </div>
    </div>
  );
}

function StepRail({ step, onStep }: { step: number; onStep: (step: number) => void }): React.ReactElement {
  return (
    <ol className="flex flex-col gap-1">
      {copy.steps.map((label, index) => (
        <li key={label}>
          <button
            aria-current={index === step ? "step" : undefined}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-start text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none",
              index === step ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            disabled={index > step}
            onClick={() => onStep(index)}
            type="button">
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[0.6875rem] tabular-nums",
                index < step && "border-info bg-info text-white",
                index === step && "border-foreground"
              )}>
              {index < step ? <CheckIcon aria-hidden="true" className="size-3" /> : index + 1}
            </span>
            {label}
          </button>
        </li>
      ))}
    </ol>
  );
}

/**
 * Creating a project in two steps: name and frame, then the app it records. A live card on the left previews the
 * result; skipping makes a project for local files only.
 */
export function NewProjectDialog({
  open,
  onOpenChange,
  defaultAppUrl,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAppUrl: string;
  onCreate: (input: NewProjectInput) => Promise<void>;
}): React.ReactElement {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => initialDraft(defaultAppUrl));
  const [pending, setPending] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep(0);
      setDraft(initialDraft(defaultAppUrl));
    }
  }
  const update = (patch: Partial<NewProjectDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const named = draft.name.trim() !== "";
  const create = async (value: NewProjectDraft) => {
    setPending(true);
    try {
      await onCreate(draftInput(value, defaultAppUrl));
    } finally {
      setPending(false);
    }
  };
  const skip = () => void create({ ...draft, app: "none" });

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="overflow-hidden sm:max-w-3xl" data-anchored-top="">
        <Form
          className="grid min-h-0 sm:grid-cols-[15rem_1fr]"
          onSubmit={(event) => {
            event.preventDefault();
            if (step === 0) {
              if (named) setStep(1);
              return;
            }
            if (draftReady(draft)) void create(draft);
          }}>
          <aside className="hidden flex-col gap-6 border-e bg-muted/40 p-5 sm:flex">
            <CardPreview draft={draft} step={step} />
            <StepRail onStep={setStep} step={step} />
            <div className="mt-auto flex flex-col gap-1">
              <button
                className="w-fit rounded-sm text-muted-foreground text-xs underline decoration-foreground/24 underline-offset-4 transition-colors duration-150 hover:text-foreground hover:decoration-foreground/48 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-64"
                disabled={!named || pending}
                onClick={skip}
                type="button">
                {copy.skip}
              </button>
              <span className="text-pretty text-muted-foreground/72 text-xs">{copy.skipHint}</span>
            </div>
          </aside>
          <div className="flex min-h-0 flex-col">
            <div className="flex flex-col gap-5 p-6">
              <StepDissolve
                render={(index) => (
                  <div className="flex flex-col gap-5 px-px pb-px">
                    <div className="flex flex-col gap-1">
                      <DialogTitle>{index === 0 ? copy.title : copy.sourceTitle}</DialogTitle>
                      <p className="text-muted-foreground text-sm">
                        {index === 0 ? copy.description : copy.sourceDescription}
                      </p>
                    </div>
                    {index === 0 ? (
                      <>
                        <NameField draft={draft} update={update} />
                        <AspectRatioPicker draft={draft} update={update} />
                      </>
                    ) : (
                      <>
                        <AppChoiceList draft={draft} update={update} />
                        <AppDetails defaultAppUrl={defaultAppUrl} draft={draft} update={update} />
                      </>
                    )}
                  </div>
                )}
                step={step}
              />
            </div>
            <div className="mt-auto flex items-center justify-end gap-2 border-t bg-muted/40 px-6 py-4">
              <Button
                className="me-auto sm:hidden"
                disabled={!named || pending}
                onClick={skip}
                variant="ghost">
                {copy.skipShort}
              </Button>
              {step === 1 ? (
                <Button onClick={() => setStep(0)} variant="ghost">
                  {copy.back}
                </Button>
              ) : null}
              <Button disabled={step === 0 ? !named : !draftReady(draft)} loading={pending} type="submit">
                {step === 0 ? copy.continue : copy.create}
              </Button>
            </div>
          </div>
        </Form>
      </DialogPopup>
    </Dialog>
  );
}
