"use client";

import { cn } from "@coss/ui/lib/utils";
import { PROPERTY_SPECS } from "@coss/vaunt-engine/storyboard/property-specs";
import type { Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { projectDuration } from "@coss/vaunt-engine/storyboard/track-resolution";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { InspectorPanel } from "./inspector/inspector-panel";
import { EDITOR_CARD_ATTRIBUTE, MirrorSplit } from "./layout/mirror-split";
import { PushPanel } from "./layout/push-panel";
import { PANEL_SPECS, usePanelLayout } from "./layout/use-panel-layout";
import { LeftSidebar } from "./left-sidebar";
import { createPlaybackClock } from "./player/playback-clock";
import { ProjectBar } from "./project-bar";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { StagePanel } from "./stage/stage-panel";
import { StageContextMenu } from "./stage-context-menu";
import { useBoardGeneration } from "./storyboard/use-board-generation";
import { useStoryboardActions } from "./storyboard/use-storyboard-actions";
import type { TimelineHandle } from "./timeline/timeline-panel";
import { TimelinePanel } from "./timeline/timeline-panel";
import { useEditorShortcuts } from "./use-editor-shortcuts";
import { useEditorState } from "./use-editor-state";
import { useProjectAutosave } from "./use-project-autosave";
import { AgentSidecar } from "@/modules/agent/agent-sidecar";
import { useAgent } from "@/modules/agent/use-agent";
import { focusAgentComposerInput } from "@/modules/agent-ui/composer-focus";
import { useSettings } from "@/modules/settings/settings-provider";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.layout;
/** Around the window and between cards: room for the sections to breathe, and the resize handles' width. */
const GAP = 10;
const CARD = "flex min-h-0 flex-col overflow-hidden rounded-xl border bg-background";
const card = { [EDITOR_CARD_ATTRIBUTE]: "" };

export function EditorView({ initialProject }: { initialProject: Project }): React.ReactElement {
  const [clock] = useState(createPlaybackClock);
  const editor = useEditorState(initialProject, clock);
  const { project } = editor;
  const layout = usePanelLayout();
  const timelineRef = useRef<TimelineHandle>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [blurEditing, setBlurEditing] = useState(false);
  const settings = useSettings();
  const openAiSettings = () => settings.open("ai");
  const saveStatus = useProjectAutosave(project);
  const storyboard = useStoryboardActions(editor);
  const generation = useBoardGeneration(project, editor.applyGeneratedClips);
  const agent = useAgent(editor, clock, {
    selectedScene: storyboard.selectedNode,
    onGenerate: () => void generation.generate(editor.board),
  });
  const agentFrame = useRef<HTMLElement>(null);

  useEffect(() => clock.setDuration(projectDuration(project)), [clock, project]);

  const toggleAgent = () => layout.toggle("agent");
  // Opens the agent if it's closed and puts the cursor in it, once it's no longer inert.
  const [focusAgent, setFocusAgent] = useState(false);
  const planWithAgent = () => {
    if (layout.sizes.agent.collapsed) toggleAgent();
    setFocusAgent(true);
  };
  useEffect(() => {
    if (!focusAgent || layout.sizes.agent.collapsed) return;
    focusAgentComposerInput(agentFrame.current);
    setFocusAgent(false);
  }, [focusAgent, layout.sizes.agent.collapsed]);

  useEditorShortcuts({
    editor,
    clock,
    timeline: timelineRef,
    onShowShortcuts: () => setShortcutsOpen(true),
    onToggleAgent: toggleAgent,
  });

  const { prompt, inspector, timeline, agent: agentPanel } = layout.sizes;

  return (
    <div
      className="flex h-[calc(100dvh-var(--titlebar-inset,0px))] flex-col overflow-hidden bg-(--editor-shell) [[data-vaunt-window]_&]:h-dvh"
      data-slot="editor-shell"
      style={{ padding: `0 ${GAP}px ${GAP}px` }}>
      <ProjectBar
        agentOpen={!agentPanel.collapsed}
        canRedo={editor.canRedo}
        canUndo={editor.canUndo}
        inspectorOpen={!inspector.collapsed}
        onRedo={editor.redo}
        onRename={editor.rename}
        onSettingsChange={editor.updateSettings}
        onToggleAgent={toggleAgent}
        onToggleInspector={() => layout.toggle("inspector")}
        onTogglePrompt={() => layout.toggle("prompt")}
        onUndo={editor.undo}
        project={project}
        promptOpen={!prompt.collapsed}
        saveStatus={saveStatus}
      />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <PushPanel
              animating={layout.animating("prompt")}
              edge="start"
              gap={GAP}
              onAnimationEnd={() => layout.settle("prompt")}
              open={!prompt.collapsed}
              size={prompt.size}
              splitter={
                <MirrorSplit
                  direction={1}
                  gap={GAP}
                  label={copy.promptSplit}
                  onChange={(size) => layout.set("prompt", size)}
                  onReset={() => layout.reset("prompt")}
                  orientation="vertical"
                  spec={PANEL_SPECS.prompt}
                  value={prompt}
                />
              }>
              <div {...card} className={cn(CARD, "flex-1")}>
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                  <LeftSidebar
                    clock={clock}
                    editor={editor}
                    generation={generation}
                    onPlanWithAgent={planWithAgent}
                    storyboard={storyboard}
                  />
                </div>
              </div>
            </PushPanel>
            <StageContextMenu clipId={editor.primaryClip?.id ?? null} editor={editor}>
              <section
                {...card}
                aria-label={STUDIO_COPY.editor.stage}
                className={cn(CARD, "relative min-w-0 flex-1")}>
                <StagePanel
                  blurEditing={
                    blurEditing || editor.selectedLanes.some((key) => PROPERTY_SPECS[key].group === "blur")
                  }
                  clock={clock}
                  onSelectClip={(clipId, additive) =>
                    clipId ? editor.selectClip(clipId, { additive }) : editor.clearSelection()
                  }
                  onSetProperty={(clipId, key, value) =>
                    editor.setCompoundAtPlayhead(clipId, key, value, `canvas:${clipId}`)
                  }
                  project={project}
                  selectedClipId={editor.primaryClip?.id ?? null}
                  singleClipSelected={editor.selection.clipIds.length === 1}
                />
              </section>
            </StageContextMenu>
            <PushPanel
              animating={layout.animating("inspector")}
              edge="end"
              gap={GAP}
              onAnimationEnd={() => layout.settle("inspector")}
              open={!inspector.collapsed}
              size={inspector.size}
              splitter={
                <MirrorSplit
                  direction={-1}
                  gap={GAP}
                  label={copy.inspectorSplit}
                  onChange={(size) => layout.set("inspector", size)}
                  onReset={() => layout.reset("inspector")}
                  orientation="vertical"
                  spec={PANEL_SPECS.inspector}
                  value={inspector}
                />
              }>
              <div {...card} className={cn(CARD, "flex-1")}>
                <InspectorPanel clock={clock} editor={editor} onBlurEditingChange={setBlurEditing} />
              </div>
            </PushPanel>
          </div>
          <MirrorSplit
            direction={-1}
            gap={GAP}
            label={copy.timelineSplit}
            onChange={(size) => layout.set("timeline", size)}
            onReset={() => layout.reset("timeline")}
            orientation="horizontal"
            spec={PANEL_SPECS.timeline}
            value={timeline}
          />
          <div {...card} className={cn(CARD, "shrink-0")} style={{ height: timeline.size }}>
            <TimelinePanel clock={clock} editor={editor} ref={timelineRef} />
          </div>
        </div>
        <AgentSidecar
          agent={agent}
          animating={layout.animating("agent")}
          frameRef={agentFrame}
          gap={GAP}
          onAnimationEnd={() => layout.settle("agent")}
          onClose={toggleAgent}
          onOpenSettings={openAiSettings}
          onReset={() => layout.reset("agent")}
          onSizeChange={(size) => layout.set("agent", size)}
          size={agentPanel}
        />
      </div>
      <ShortcutsDialog onOpenChange={setShortcutsOpen} open={shortcutsOpen} />
    </div>
  );
}
