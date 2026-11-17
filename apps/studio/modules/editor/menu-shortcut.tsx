"use client";

import { ContextMenuShortcut } from "@coss/ui/components/context-menu";
import type * as React from "react";
import { type EditorAction, shortcutKeys } from "./editor-keymap";
import { useIsMac } from "./use-is-mac";

export function MenuShortcut({ action }: { action: EditorAction }): React.ReactElement {
  const mac = useIsMac();
  return <ContextMenuShortcut>{shortcutKeys(action, mac).join(mac ? "" : "+")}</ContextMenuShortcut>;
}
