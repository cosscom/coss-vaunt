"use client";

import type { ExportEvent } from "@coss/vaunt-engine/export/export-events";
import type { ExportSettings } from "@coss/vaunt-engine/export/export-settings";
import { useCallback, useEffect, useRef, useState } from "react";

const RECONNECT_MS = 1000;

export type ExportPhase = Extract<ExportEvent, { type: "phase" }>["phase"];

export type ExportState =
  | { status: "idle" }
  | { status: "starting" }
  | { status: "running"; phase: ExportPhase; frame: number; frameCount: number; etaSeconds: number | null }
  | { status: "done"; file: string; bytes: number }
  | { status: "error"; message: string };

/** Applies one streamed event to the export's state. */
export function nextExportState(state: ExportState, event: ExportEvent | { type: "idle" }): ExportState {
  const running =
    state.status === "running"
      ? state
      : { status: "running" as const, phase: "load" as const, frame: 0, frameCount: 0, etaSeconds: null };
  switch (event.type) {
    case "idle":
      return state.status === "starting" ? state : { status: "idle" };
    case "phase":
      return { ...running, phase: event.phase };
    case "frame":
      return {
        ...running,
        phase: "frames",
        frame: event.frame,
        frameCount: event.frameCount,
        etaSeconds: event.etaSeconds,
      };
    case "done":
      return { status: "done", file: event.file, bytes: event.bytes };
    case "error":
      return { status: "error", message: event.message };
  }
}

/** The project's export: start one, follow its progress (also one already running when the editor opens), cancel it. */
export function useProjectExport(projectId: string) {
  const url = `/api/projects/${encodeURIComponent(projectId)}/exports`;
  const [state, setState] = useState<ExportState>({ status: "idle" });
  const source = useRef<EventSource | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(state);
  latest.current = state;

  const follow = useCallback(() => {
    source.current?.close();
    clearTimeout(retry.current);
    const events = new EventSource(url);
    source.current = events;
    events.onmessage = (message) => {
      const event = JSON.parse(message.data) as ExportEvent | { type: "idle" };
      setState((current) => nextExportState(current, event));
      if (event.type === "done" || event.type === "error" || event.type === "idle") events.close();
    };
    // A dropped stream mid-export reconnects; the server replays where the export got to.
    events.onerror = () => {
      events.close();
      const { status } = latest.current;
      if (status === "running" || status === "starting") retry.current = setTimeout(follow, RECONNECT_MS);
    };
  }, [url]);

  useEffect(() => {
    follow();
    return () => {
      clearTimeout(retry.current);
      source.current?.close();
    };
  }, [follow]);

  const start = async (settings: ExportSettings) => {
    setState({ status: "starting" });
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings),
    }).catch(() => null);
    if (!response || (!response.ok && response.status !== 409)) {
      const body = (await response?.json().catch(() => null)) as { error?: string } | null;
      setState({ status: "error", message: body?.error ?? "Couldn’t start the export" });
      return;
    }
    follow();
  };

  const cancel = () => void fetch(url, { method: "DELETE" });
  const reset = () => setState({ status: "idle" });

  return { state, start, cancel, reset };
}
