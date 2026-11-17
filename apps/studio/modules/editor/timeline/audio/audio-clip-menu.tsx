"use client";

import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuPopup,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@coss/ui/components/context-menu";
import type * as React from "react";
import { AUDIO_COPY } from "../../audio/audio-copy";
import { MenuShortcut } from "../../menu-shortcut";
import type { AudioActions } from "./audio-actions";

const copy = AUDIO_COPY.menu;

type AudioClipMenuProps = {
  clipId: string;
  trackIndex: number;
  trackMuted: boolean;
  actions: AudioActions;
  /** Selects the clip first when it isn't part of the selection. */
  onOpen: () => void;
  children: React.ReactNode;
};

/** Its own menu, so a right-click on an audio clip doesn't also open the timeline's. */
export function AudioClipMenu({
  clipId,
  trackIndex,
  trackMuted,
  actions,
  onOpen,
  children,
}: AudioClipMenuProps): React.ReactElement {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        className="contents"
        onContextMenu={(event) => {
          event.stopPropagation();
          onOpen();
        }}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuPopup>
        <ContextMenuItem onClick={actions.duplicate}>
          {copy.duplicate}
          <MenuShortcut action="duplicate" />
        </ContextMenuItem>
        <ContextMenuItem onClick={actions.split}>
          {copy.split}
          <MenuShortcut action="split" />
        </ContextMenuItem>
        <ContextMenuItem onClick={() => actions.addVolumeKeyframe(clipId)}>
          {copy.addVolumeKeyframe}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => actions.setMuted(trackIndex, !trackMuted)}>
          {trackMuted ? copy.unmuteTrack : copy.muteTrack}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={actions.remove} variant="destructive">
          {copy.delete}
          <MenuShortcut action="delete-selection" />
        </ContextMenuItem>
      </ContextMenuPopup>
    </ContextMenu>
  );
}
