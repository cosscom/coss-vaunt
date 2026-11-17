"use client";

import { Button } from "@coss/ui/components/button";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@coss/ui/components/tabs";
import { ChevronDownIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useState } from "react";
import { AssetsPanel } from "./assets/assets-panel";
import { useProjectAssets } from "./assets/use-project-assets";
import { EasingSection } from "./easing/easing-section";
import type { PlaybackClock } from "./player/playback-clock";
import { StoryboardPanel } from "./storyboard/storyboard-panel";
import type { EditorState } from "./use-editor-state";
import { STUDIO_COPY } from "@/modules/studio-copy";

type SidebarTab = "storyboard" | "assets";

/**
 * Storyboard and assets share the top of the left sidebar; the easing editor stays pinned below them. The storyboard
 * canvas takes whatever height the other sections leave.
 */
export function LeftSidebar({
  editor,
  clock,
}: {
  editor: EditorState;
  clock: PlaybackClock;
}): React.ReactElement {
  const [tab, setTab] = useState<SidebarTab>("storyboard");
  const [open, setOpen] = useState(true);
  // The storyboard's media picker needs the imported files too, so the listing stays live on both tabs.
  const { assets, failed, refresh } = useProjectAssets(editor.project, true);
  const files = (assets?.files ?? []).filter((file) => file.kind !== "audio");

  return (
    <>
      <Tabs
        className={cn("gap-0", open ? "flex-1" : "shrink-0")}
        onValueChange={(value: SidebarTab) => {
          setTab(value);
          setOpen(true);
        }}
        value={tab}>
        <div className="flex h-10 shrink-0 items-center gap-1 border-b ps-2 pe-1">
          <TabsList className="flex-1" size="sm">
            <TabsTab value="storyboard">{STUDIO_COPY.storyboard.tab}</TabsTab>
            <TabsTab value="assets">{STUDIO_COPY.assets.tab}</TabsTab>
          </TabsList>
          <Button
            aria-expanded={open}
            aria-label={open ? STUDIO_COPY.sidebar.collapse : STUDIO_COPY.sidebar.expand}
            onClick={() => setOpen((value) => !value)}
            size="icon-sm"
            variant="ghost">
            <ChevronDownIcon
              aria-hidden="true"
              className={cn("text-muted-foreground transition-transform", !open && "-rotate-90")}
            />
          </Button>
        </div>
        {/* Collapsing hides rather than unmounts, so a running generation keeps its progress. */}
        <TabsPanel className={cn("flex flex-col", !open && "hidden")} keepMounted value="storyboard">
          <StoryboardPanel editor={editor} files={files} onAssetsChanged={refresh} />
        </TabsPanel>
        <TabsPanel className={cn(!open && "hidden")} value="assets">
          <AssetsPanel assets={assets} editor={editor} failed={failed} />
        </TabsPanel>
      </Tabs>
      <EasingSection clock={clock} editor={editor} />
    </>
  );
}
