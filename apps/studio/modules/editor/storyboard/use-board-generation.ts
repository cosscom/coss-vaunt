"use client";

import { toastManager } from "@coss/ui/components/toast";
import type { Board } from "@coss/vaunt-engine/storyboard/board-schema";
import type { Clip, Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { useEffect, useRef, useState } from "react";
import { saveProjectInOrder } from "../project-save-queue";
import { appliedScenes, saveAppliedScenes } from "./generation-applied";
import {
  applyGenerationEvent,
  failUnfinished,
  isDoneEvent,
  type NodeGeneration,
  parseGenerationStream,
} from "./generation-stream";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.storyboard.prompt;

async function errorMessage(response: Response): Promise<string> {
  if (response.status === 404) return copy.unavailable;
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : response.statusText;
}

/**
 * Sends the board to the agent and follows its job stream. Statuses are per node and live only here; each
 * node's clips are handed to `onClips` as they finish, so every node lands as its own undo step. Opening the
 * editor picks up the project's latest job, so clips finished while it was closed still land.
 */
export type BoardGeneration = {
  statuses: Record<string, NodeGeneration>;
  running: boolean;
  generate: (board: Board, nodeIds?: string[]) => Promise<void>;
};

export function useBoardGeneration(
  project: Project,
  onClips: (nodeId: string, clips: Clip[]) => void
): BoardGeneration {
  const [statuses, setStatuses] = useState<Record<string, NodeGeneration>>({});
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const onClipsRef = useRef(onClips);
  onClipsRef.current = onClips;
  const projectRef = useRef(project);
  projectRef.current = project;
  const projectId = project.id;
  const base = `/api/projects/${encodeURIComponent(projectId)}/storyboard/generate`;

  /** Applies the job's finished clips once each; `showStatus` is off when catching up on a finished job. */
  const follow = async (jobId: string, signal: AbortSignal, showStatus: boolean) => {
    const applied = appliedScenes(localStorage, projectId, jobId);
    const stream = await fetch(`${base}/${encodeURIComponent(jobId)}`, {
      headers: { Accept: "text/event-stream" },
      signal,
    });
    if (!stream.ok || !stream.body) throw new Error(await errorMessage(stream));
    const reader = stream.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      const parsed = parseGenerationStream(buffer + value);
      buffer = parsed.rest;
      for (const event of parsed.events) {
        if (isDoneEvent(event)) return;
        if (showStatus) setStatuses((current) => applyGenerationEvent(current, event));
        if (event.status !== "done" || !event.clips || applied.has(event.nodeId)) continue;
        onClipsRef.current(event.nodeId, event.clips);
        applied.add(event.nodeId);
        saveAppliedScenes(localStorage, projectId, jobId, applied);
      }
    }
  };

  const run = async (
    start: (signal: AbortSignal) => Promise<{ jobId: string; showStatus: boolean } | null>
  ) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    try {
      const job = await start(controller.signal);
      if (!job) return;
      if (job.showStatus) setRunning(true);
      await follow(job.jobId, controller.signal, job.showStatus);
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : copy.generateFailed;
      toastManager.add({ type: "error", title: copy.generateFailed, description: message });
      setStatuses((current) => failUnfinished(current, message));
    } finally {
      if (abort.current === controller) {
        abort.current = null;
        setRunning(false);
        setStatuses((current) => failUnfinished(current, copy.generateFailed));
      }
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: catches up once per project; `run` reads refs.
  useEffect(() => {
    void run(async (signal) => {
      const response = await fetch(base, { signal });
      if (!response.ok) return null;
      const job = (await response.json()) as { jobId: string; finished: boolean };
      return { jobId: job.jobId, showStatus: !job.finished };
    });
    return () => abort.current?.abort();
  }, [base]);

  const generate = (board: Board, nodeIds?: string[]) => {
    const targets = nodeIds ?? board.nodes.map((node) => node.id);
    setStatuses((current) => ({
      ...current,
      ...Object.fromEntries(targets.map((id): [string, NodeGeneration] => [id, { status: "queued" }])),
    }));
    return run(async (signal) => {
      await saveProjectInOrder(projectRef.current);
      const started = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nodeIds ? { board, nodeIds } : { board }),
        signal,
      });
      if (!started.ok) throw new Error(await errorMessage(started));
      const { jobId } = (await started.json()) as { jobId: string };
      return { jobId, showStatus: true };
    });
  };

  return { statuses, running, generate };
}
