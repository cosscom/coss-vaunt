"use client";

import { layoutBoard } from "@calcom/product-video/storyboard/board-edits";
import { type Board, boardSchema } from "@calcom/product-video/storyboard/board-schema";
import { toastManager } from "@coss/ui/components/toast";
import { useState } from "react";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.storyboard.prompt;

export type DraftRequest = { prompt: string; routes: string[]; totalSeconds: number; board?: Board };

/** Asks the agent to draft a board from the brief; resolves with it laid out, or null when it failed. */
export function useBoardDraft(projectId: string): {
  drafting: boolean;
  draft: (request: DraftRequest) => Promise<Board | null>;
} {
  const [drafting, setDrafting] = useState(false);

  const draft = async (request: DraftRequest) => {
    setDrafting(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/storyboard/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
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
      return layoutBoard({ ...parsed.data, brief: request.prompt });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: copy.draftFailed,
        description: error instanceof Error ? error.message : undefined,
      });
      return null;
    } finally {
      setDrafting(false);
    }
  };

  return { drafting, draft };
}
