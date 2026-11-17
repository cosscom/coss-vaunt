"use client";

import type { Board } from "@calcom/product-video/storyboard/board-schema";
import type { Clip } from "@calcom/product-video/storyboard/storyboard-schema";
import { toastManager } from "@coss/ui/components/toast";
import { useEffect, useRef, useState } from "react";
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
 * node's clips are handed to `onClips` as they finish, so every node lands as its own undo step.
 */
export function useBoardGeneration(
  projectId: string,
  onClips: (nodeId: string, clips: Clip[]) => void
): {
  statuses: Record<string, NodeGeneration>;
  running: boolean;
  generate: (board: Board, nodeIds?: string[]) => Promise<void>;
} {
  const [statuses, setStatuses] = useState<Record<string, NodeGeneration>>({});
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const onClipsRef = useRef(onClips);
  onClipsRef.current = onClips;

  useEffect(() => () => abort.current?.abort(), []);

  const generate = async (board: Board, nodeIds?: string[]) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const targets = nodeIds ?? board.nodes.map((node) => node.id);
    setStatuses((current) => ({
      ...current,
      ...Object.fromEntries(targets.map((id): [string, NodeGeneration] => [id, { status: "queued" }])),
    }));
    setRunning(true);
    const base = `/api/projects/${encodeURIComponent(projectId)}/storyboard/generate`;
    try {
      const started = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nodeIds ? { board, nodeIds } : { board }),
        signal: controller.signal,
      });
      if (!started.ok) throw new Error(await errorMessage(started));
      const { jobId } = (await started.json()) as { jobId: string };
      const stream = await fetch(`${base}/${encodeURIComponent(jobId)}`, {
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      });
      if (!stream.ok || !stream.body) throw new Error(await errorMessage(stream));
      const reader = stream.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const parsed = parseGenerationStream(buffer + value);
        buffer = parsed.rest;
        for (const event of parsed.events) {
          if (isDoneEvent(event)) return;
          setStatuses((current) => applyGenerationEvent(current, event));
          if (event.status === "done" && event.clips) onClipsRef.current(event.nodeId, event.clips);
        }
      }
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

  return { statuses, running, generate };
}
