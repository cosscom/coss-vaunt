"use client";

import { toastManager } from "@coss/ui/components/toast";
import { layoutBoard } from "@coss/vaunt-engine/storyboard/board-edits";
import { type Board, boardSchema } from "@coss/vaunt-engine/storyboard/board-schema";
import { useRef, useState } from "react";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.storyboard.prompt;

/** With `focusNodeId`, the agent revises that scene of `board` and `prompt` is an instruction, not the brief. */
export type DraftRequest = { prompt: string; totalSeconds: number; board?: Board; focusNodeId?: string };

/** Asks the agent to draft a board from the brief; resolves with it laid out, or null when it failed or stopped. */
export function useBoardDraft(projectId: string): {
  drafting: boolean;
  draft: (request: DraftRequest) => Promise<Board | null>;
  stop: () => void;
} {
  const [drafting, setDrafting] = useState(false);
  const controller = useRef<AbortController | null>(null);

  const draft = async (request: DraftRequest) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setDrafting(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/storyboard/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: current.signal,
      });
      const body = (await response.json().catch(() => null)) as { board?: unknown; error?: unknown } | null;
      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? copy.unavailable
            : typeof body?.error === "string"
              ? body.error
              : response.statusText
        );
      }
      const parsed = boardSchema.safeParse(body?.board);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      return request.focusNodeId ? parsed.data : layoutBoard({ ...parsed.data, brief: request.prompt });
    } catch (error) {
      if (current.signal.aborted) return null;
      toastManager.add({
        type: "error",
        title: request.focusNodeId ? copy.reviseFailed : copy.draftFailed,
        description: error instanceof Error ? error.message : undefined,
      });
      return null;
    } finally {
      if (controller.current === current) {
        controller.current = null;
        setDrafting(false);
      }
    }
  };

  return { drafting, draft, stop: () => controller.current?.abort() };
}
