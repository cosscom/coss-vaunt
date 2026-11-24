"use client";

import { Button } from "@coss/ui/components/button";
import { Progress } from "@coss/ui/components/progress";
import { Spinner } from "@coss/ui/components/spinner";
import { toastManager } from "@coss/ui/components/toast";
import { CircleAlertIcon, CircleCheckIcon, VideoIcon } from "@coss/ui/icons";
import type { RecordingStreamEvent } from "@coss/vaunt-engine/recording/recording-events";
import type { Clip, Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveProjectInOrder } from "../project-save-queue";
import { RECORDING_COPY as copy } from "./recording-copy";
import { announceRecordingFinished } from "./recording-finished";
import {
  nextRecordingViewState,
  type RecordingViewState,
  recordingPercent,
  recordingStarted,
} from "./recording-view-state";

export type RecordClipButtonProps = { project: Project; clip: Clip };

/** Waits for autosave before asking whether the edited clip is already recorded. */
const STATUS_DELAY_MS = 800;

function recordUrl(projectId: string, clipId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/record`;
}

/** Records the clip from the inspector's Source section and shows whether its current version is recorded. */
export function RecordClipButton({ project, clip }: RecordClipButtonProps): React.ReactElement | null {
  const [state, setState] = useState<RecordingViewState>({ kind: "checking" });
  const source = useRef<EventSource | null>(null);
  const url = recordUrl(project.id, clip.id);

  const follow = useCallback(
    (announce: boolean) => {
      source.current?.close();
      const events = new EventSource(url);
      source.current = events;
      events.onmessage = (message: MessageEvent<string>) => {
        const event = JSON.parse(message.data) as RecordingStreamEvent;
        setState((previous) => nextRecordingViewState(previous, event));
        if (event.type === "done" || event.type === "error" || event.type === "status") events.close();
        if (event.type === "done") announceRecordingFinished();
        if (!announce) return;
        if (event.type === "done")
          toastManager.add({ type: "success", title: copy.doneToast(event.frameCount) });
        if (event.type === "error")
          toastManager.add({ type: "error", title: copy.failedToast, description: event.message });
      };
      events.onerror = () => events.close();
    },
    [url]
  );

  const captureKey = JSON.stringify([
    clip.source,
    clip.duration,
    clip.focus,
    clip.properties.zoom,
    clip.properties.scale,
  ]);
  useEffect(() => {
    void captureKey;
    const timer = setTimeout(() => follow(false), STATUS_DELAY_MS);
    return () => {
      clearTimeout(timer);
      source.current?.close();
    };
  }, [captureKey, follow]);

  if (clip.source.kind !== "recording") return null;

  const record = async () => {
    setState(recordingStarted());
    const response = await saveProjectInOrder(project)
      .then(() =>
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: state.kind === "recorded" }),
        })
      )
      .catch(() => null);
    if (!response || (!response.ok && response.status !== 409)) {
      setState({ kind: "failed", message: copy.failed });
      toastManager.add({ type: "error", title: copy.failedToast });
      return;
    }
    follow(true);
  };

  const recording = state.kind === "recording";
  return (
    <div className="flex flex-col gap-2">
      {state.kind === "recording" ? (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Spinner className="size-3.5" />
            {state.phase === "capture" && state.frameCount
              ? `${copy.frame(state.frame, state.frameCount)}${state.etaSeconds === null ? "" : ` · ${copy.eta(state.etaSeconds)}`}`
              : copy.phases[state.phase]}
          </p>
          <Progress value={recordingPercent(state)} />
        </div>
      ) : null}
      {state.kind === "checking" ? <p className="text-muted-foreground text-xs">{copy.checking}</p> : null}
      {state.kind === "idle" ? <p className="text-muted-foreground text-xs">{copy.notRecorded}</p> : null}
      {state.kind === "recorded" ? (
        <p className="flex items-center gap-1.5 text-xs">
          <CircleCheckIcon aria-hidden="true" className="size-3.5 text-success-foreground" />
          {copy.recorded(state.frameCount)}
          <code className="text-muted-foreground">{state.captureHash.slice(0, 8)}</code>
        </p>
      ) : null}
      {state.kind === "failed" ? (
        <p className="flex items-start gap-1.5 text-destructive-foreground text-xs">
          <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span className="wrap-anywhere">{state.message}</span>
        </p>
      ) : null}
      <Button
        disabled={recording || state.kind === "checking"}
        onClick={() => void record()}
        size="sm"
        variant="outline">
        <VideoIcon aria-hidden="true" />
        {state.kind === "recorded" ? copy.rerecord : copy.record}
      </Button>
    </div>
  );
}
