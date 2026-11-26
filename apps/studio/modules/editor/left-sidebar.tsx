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
import { MotionSection } from "./motion/motion-section";
import type { PlaybackClock } from "./player/playback-clock";
import { StoryboardPanel } from "./storyboard/storyboard-panel";
import type { BoardGeneration } from "./storyboard/use-board-generation";
import type { StoryboardActions } from "./storyboard/use-storyboard-actions";
import type { EditorState } from "./use-editor-state";
import { STUDIO_COPY } from "@/modules/studio-copy";

type SidebarTab = "storyboard" | "assets";

/**
 * Storyboard and assets share the top of the left sidebar, with motion presets and the easing editor below. Open, the storyboard
 * canvas takes whatever height the other sections leave; it starts collapsed once the timeline has clips.
 */
export function LeftSidebar({
  editor,
  clock,
  storyboard,
  generation,
  onPlanWithAgent,
}: {
  editor: EditorState;
  clock: PlaybackClock;
  /** The board's edits and selection, shared with the agent so it sees the selected scene. */
  storyboard: StoryboardActions;
  generation: BoardGeneration;
  onPlanWithAgent: () => void;
}): React.ReactElement {
  const [tab, setTab] = useState<SidebarTab>("storyboard");
  // Open while there's nothing on the timeline to make; once there is, the storyboard steps aside for the stage.
  const [open, setOpen] = useState(() =>
    editor.project.videoTracks.every((track) => track.clips.length === 0)
  );
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
        <div className={cn("flex shrink-0 items-center gap-1", open && "border-b")} data-snug="">
          <TabsList className="flex-1">
            <TabsTab value="storyboard">{STUDIO_COPY.storyboard.tab}</TabsTab>
            <TabsTab value="assets">{STUDIO_COPY.assets.tab}</TabsTab>
          </TabsList>
          <Button
            aria-expanded={open}
            aria-label={open ? STUDIO_COPY.sidebar.collapse : STUDIO_COPY.sidebar.expand}
            onClick={() => setOpen((value) => !value)}
            size="icon"
            variant="ghost">
            <ChevronDownIcon
              aria-hidden="true"
              className={cn("text-muted-foreground transition-transform", !open && "-rotate-90")}
            />
          </Button>
        </div>
        {/* Collapsing hides rather than unmounts, so a running generation keeps its progress. */}
        <TabsPanel className={cn("flex flex-col", !open && "hidden")} keepMounted value="storyboard">
          <StoryboardPanel
            actions={storyboard}
            files={files}
            generation={generation}
            onAssetsChanged={refresh}
            onPlanWithAgent={onPlanWithAgent}
            projectId={editor.project.id}
          />
        </TabsPanel>
        <TabsPanel className={cn(!open && "hidden")} value="assets">
          <AssetsPanel assets={assets} editor={editor} failed={failed} />
        </TabsPanel>
      </Tabs>
      <MotionSection editor={editor} />
      <EasingSection clock={clock} editor={editor} />
      {/* Collapsed, the section headers stack at the top instead of leaving a gap above them. */}
      {open ? null : <div aria-hidden="true" className="flex-1 border-t" />}
    </>
  );
}
