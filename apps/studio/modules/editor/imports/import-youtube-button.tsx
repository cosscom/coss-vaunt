"use client";

import { Alert, AlertDescription } from "@coss/ui/components/alert";
import { Button } from "@coss/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@coss/ui/components/dialog";
import { Field, FieldDescription, FieldLabel } from "@coss/ui/components/field";
import { Form } from "@coss/ui/components/form";
import { Input } from "@coss/ui/components/input";
import { Progress } from "@coss/ui/components/progress";
import { CircleAlertIcon, UploadIcon } from "@coss/ui/icons";
import { SegmentedRadio, SegmentedRadioGroup } from "@coss/ui/shared/segmented-radio-group";
import type { YoutubeImportProgress } from "@coss/vaunt-engine/imports/youtube-import";
import type { Clip } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type * as React from "react";
import { useRef, useState } from "react";
import { MediaUploadPanel } from "./media-upload-panel";
import { YOUTUBE_IMPORT_COPY as copy } from "./youtube-import-copy";
import { readImportEvents } from "./youtube-import-events";

export type ImportYoutubeButtonProps = {
  projectId: string;
  /** Called with a ready import clip; the editor places it on a track at the playhead. */
  onImported: (clip: Clip) => void;
};

type ImportMode = "youtube" | "upload";

type ImportState =
  | { status: "idle" }
  | { status: "running"; progress: YoutubeImportProgress | null }
  | { status: "failed"; message: string };

function progressLabel(progress: YoutubeImportProgress | null): string {
  if (!progress) return copy.starting;
  if (progress.stage === "downloading") {
    return progress.percent === null
      ? copy.downloading
      : copy.downloadingPercent(Math.round(progress.percent));
  }
  return progress.stage === "cached" ? copy.cached : copy.probing;
}

async function runImport(
  projectId: string,
  input: string,
  signal: AbortSignal,
  onProgress: (progress: YoutubeImportProgress) => void
): Promise<Clip> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/imports/youtube`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
    signal,
  });
  if (!response.ok || !response.body) {
    const body: unknown = await response.json().catch(() => null);
    const message = body && typeof body === "object" && "error" in body ? String(body.error) : copy.failed;
    throw new Error(message);
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffered = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const { events, rest } = readImportEvents(buffered + value);
    buffered = rest;
    for (const event of events) {
      if (event.type === "progress") onProgress(event.progress);
      if (event.type === "error") throw new Error(event.message);
      if (event.type === "done") return event.clip;
    }
  }
  throw new Error(copy.failed);
}

/** Imports media into the project: an upload from disk, or (dev-only test footage) a YouTube download. */
export function ImportYoutubeButton({ projectId, onImported }: ImportYoutubeButtonProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ImportMode>("upload");
  const [input, setInput] = useState("");
  const [state, setState] = useState<ImportState>({ status: "idle" });
  const abort = useRef<AbortController | null>(null);
  const running = state.status === "running";

  const onOpenChange = (next: boolean) => {
    if (!next) abort.current?.abort();
    setOpen(next);
    if (next) setState({ status: "idle" });
  };

  const submit = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setState({ status: "running", progress: null });
    try {
      const clip = await runImport(projectId, input, controller.signal, (progress) =>
        setState({ status: "running", progress })
      );
      onImported(clip);
      setState({ status: "idle" });
      setInput("");
      setOpen(false);
    } catch (error) {
      if (controller.signal.aborted) return;
      setState({ status: "failed", message: error instanceof Error ? error.message : copy.failed });
    }
  };

  const percent =
    state.status === "running" && state.progress?.stage === "downloading" ? state.progress.percent : null;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <UploadIcon aria-hidden="true" />
        {copy.trigger}
      </DialogTrigger>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <SegmentedRadioGroup
            aria-label={copy.modeLabel}
            className="mt-2"
            onValueChange={(value) => {
              if (value !== "youtube" && value !== "upload") return;
              abort.current?.abort();
              setState({ status: "idle" });
              setMode(value);
            }}
            size="sm"
            value={mode}>
            <SegmentedRadio value="youtube">{copy.youtubeMode}</SegmentedRadio>
            <SegmentedRadio value="upload">{copy.uploadMode}</SegmentedRadio>
          </SegmentedRadioGroup>
          <DialogDescription>
            {mode === "upload" ? copy.uploadDescription : copy.description}
          </DialogDescription>
        </DialogHeader>
        {mode === "upload" ? (
          <>
            <DialogPanel>
              <MediaUploadPanel
                onImported={(clips) => {
                  for (const clip of clips) onImported(clip);
                  setOpen(false);
                }}
                projectId={projectId}
              />
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant="ghost" />}>{copy.cancel}</DialogClose>
            </DialogFooter>
          </>
        ) : (
          <Form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              if (input.trim() && !running) void submit();
            }}>
            <DialogPanel className="flex flex-col gap-4">
              <Field>
                <FieldLabel>{copy.inputLabel}</FieldLabel>
                <Input
                  autoFocus
                  disabled={running}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={copy.inputPlaceholder}
                  required
                  value={input}
                />
                <FieldDescription>{copy.inputDescription}</FieldDescription>
              </Field>
              {state.status === "running" ? (
                <div className="flex flex-col gap-2">
                  <p className="text-muted-foreground text-sm">{progressLabel(state.progress)}</p>
                  <Progress value={percent} />
                </div>
              ) : null}
              {state.status === "failed" ? (
                <Alert variant="error">
                  <CircleAlertIcon aria-hidden="true" />
                  <AlertDescription>{state.message}</AlertDescription>
                </Alert>
              ) : null}
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant="ghost" />}>{copy.cancel}</DialogClose>
              <Button disabled={!input.trim()} loading={running} type="submit">
                {copy.submit}
              </Button>
            </DialogFooter>
          </Form>
        )}
      </DialogPopup>
    </Dialog>
  );
}
