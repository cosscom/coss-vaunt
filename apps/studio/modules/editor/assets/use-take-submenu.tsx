"use client";

import {
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSub,
  ContextMenuSubPopup,
  ContextMenuSubTrigger,
} from "@coss/ui/components/context-menu";
import {
  type AssetTake,
  type ProjectAssets,
  pinnedTakeFor,
} from "@coss/vaunt-engine/project-store/project-assets";
import { findClip } from "@coss/vaunt-engine/storyboard/storyboard-edits";
import type * as React from "react";
import { useEffect, useState } from "react";
import { formatTimecode } from "../timeline/format-timecode";
import type { EditorState } from "../use-editor-state";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.assets;

/** "Use take" on a recording clip: every take recorded for it, newest first; picking one pins it. */
export function UseTakeSubmenu({
  editor,
  clipId,
}: {
  editor: EditorState;
  clipId: string;
}): React.ReactElement | null {
  const [takes, setTakes] = useState<AssetTake[] | null>(null);
  const clip = findClip(editor.project, clipId);
  const projectId = editor.project.id;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/projects/${encodeURIComponent(projectId)}/assets`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? (response.json() as Promise<ProjectAssets>) : null))
      .then((assets) => setTakes(assets?.recordings.find((group) => group.clipId === clipId)?.takes ?? []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [projectId, clipId]);

  if (clip?.source.kind !== "recording") return null;
  const active = takes?.find((take) => take.active)?.hash ?? "";
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger disabled={!takes || takes.length === 0}>{copy.useTake}</ContextMenuSubTrigger>
      <ContextMenuSubPopup>
        <ContextMenuRadioGroup
          onValueChange={(hash: string) =>
            editor.setClipTake(clipId, pinnedTakeFor(editor.project, clip, hash))
          }
          value={active}>
          {(takes ?? []).map((take, index, all) => (
            <ContextMenuRadioItem disabled={!take.thumbnail} key={take.hash} value={take.hash}>
              {copy.take(all.length - index)}
              <span className="ms-auto ps-4 text-muted-foreground text-xs tabular-nums">
                {take.frameCount > 0 ? formatTimecode(take.frameCount / take.fps) : copy.unfinished}
              </span>
            </ContextMenuRadioItem>
          ))}
        </ContextMenuRadioGroup>
      </ContextMenuSubPopup>
    </ContextMenuSub>
  );
}
