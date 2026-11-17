"use client";

import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuPopup,
  ContextMenuTrigger,
} from "@coss/ui/components/context-menu";
import type * as React from "react";
import { MenuShortcut } from "./menu-shortcut";
import type { EditorState } from "./use-editor-state";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.timeline.menu;

/** Wraps the stage so right-clicking the preview offers camera actions for the selected clip. */
export function StageContextMenu({
  editor,
  clipId,
  children,
}: {
  editor: EditorState;
  clipId: string | null;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</ContextMenuTrigger>
      <ContextMenuPopup className="min-w-56">
        <ContextMenuItem disabled={!clipId} onClick={() => clipId && editor.resetCamera(clipId)}>
          {copy.resetCamera}
        </ContextMenuItem>
        <ContextMenuItem disabled={!clipId} onClick={() => editor.addCameraKeyframes(clipId)}>
          {copy.addCameraKeyframes}
          <MenuShortcut action="add-camera-keyframes" />
        </ContextMenuItem>
      </ContextMenuPopup>
    </ContextMenu>
  );
}
