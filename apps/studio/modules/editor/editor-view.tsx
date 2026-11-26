"use client";

import { PROPERTY_SPECS } from "@coss/vaunt-engine/storyboard/property-specs";
import type { Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { projectDuration } from "@coss/vaunt-engine/storyboard/track-resolution";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { InspectorPanel } from "./inspector/inspector-panel";
import { ResizableSplit } from "./layout/resizable-split";
import { PANEL_SPECS, usePanelLayout } from "./layout/use-panel-layout";
import { LeftSidebar } from "./left-sidebar";
import { createPlaybackClock } from "./player/playback-clock";
import { ProjectBar } from "./project-bar";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { StagePanel } from "./stage/stage-panel";
import { StageContextMenu } from "./stage-context-menu";
import type { TimelineHandle } from "./timeline/timeline-panel";
import { TimelinePanel } from "./timeline/timeline-panel";
import { useEditorShortcuts } from "./use-editor-shortcuts";
import { useEditorState } from "./use-editor-state";
import { useProjectAutosave } from "./use-project-autosave";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.layout;
export function EditorView({ initialProject }: { initialProject: Project }): React.ReactElement {
  const [clock] = useState(createPlaybackClock);
  const editor = useEditorState(initialProject, clock);
  const { project } = editor;
  const layout = usePanelLayout();
  const timelineRef = useRef<TimelineHandle>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [blurEditing, setBlurEditing] = useState(false);
  const saveStatus = useProjectAutosave(project);

  useEffect(() => clock.setDuration(projectDuration(project)), [clock, project]);

  useEditorShortcuts({ editor, clock, timeline: timelineRef, onShowShortcuts: () => setShortcutsOpen(true) });

  const { prompt, inspector, timeline } = layout.sizes;

  return (
    <div className="flex h-[calc(100dvh-var(--titlebar-inset,0px))] flex-col overflow-hidden bg-background">
      <ProjectBar
        canRedo={editor.canRedo}
        canUndo={editor.canUndo}
        inspectorOpen={!inspector.collapsed}
        onRedo={editor.redo}
        onRename={editor.rename}
        onSettingsChange={editor.updateSettings}
        onToggleInspector={() => layout.toggle("inspector")}
        onTogglePrompt={() => layout.toggle("prompt")}
        onUndo={editor.undo}
        project={project}
        promptOpen={!prompt.collapsed}
        saveStatus={saveStatus}
      />
      <div className="flex min-h-0 flex-1">
        {prompt.collapsed ? null : (
          <div className="flex min-h-0 shrink-0 flex-col overflow-y-auto" style={{ width: prompt.size }}>
            <LeftSidebar clock={clock} editor={editor} />
          </div>
        )}
        <ResizableSplit
          direction={1}
          label={copy.promptSplit}
          onChange={(size) => layout.set("prompt", size)}
          onReset={() => layout.reset("prompt")}
          orientation="vertical"
          spec={PANEL_SPECS.prompt}
          value={prompt}
        />
        <StageContextMenu clipId={editor.primaryClip?.id ?? null} editor={editor}>
          <section aria-label={STUDIO_COPY.editor.stage} className="flex min-h-0 min-w-0 flex-1 flex-col">
            <StagePanel
              clock={clock}
              onSetProperty={(clipId, key, value) =>
                editor.setCompoundAtPlayhead(clipId, key, value, `canvas:${clipId}`)
              }
              blurEditing={
                blurEditing || editor.selectedLanes.some((key) => PROPERTY_SPECS[key].group === "blur")
              }
              onSelectClip={(clipId, additive) =>
                clipId ? editor.selectClip(clipId, { additive }) : editor.clearSelection()
              }
              project={project}
              selectedClipId={editor.primaryClip?.id ?? null}
              singleClipSelected={editor.selection.clipIds.length === 1}
            />
          </section>
        </StageContextMenu>
        <ResizableSplit
          direction={-1}
          label={copy.inspectorSplit}
          onChange={(size) => layout.set("inspector", size)}
          onReset={() => layout.reset("inspector")}
          orientation="vertical"
          spec={PANEL_SPECS.inspector}
          value={inspector}
        />
        {inspector.collapsed ? null : (
          <div className="flex min-h-0 shrink-0 flex-col" style={{ width: inspector.size }}>
            <InspectorPanel clock={clock} editor={editor} onBlurEditingChange={setBlurEditing} />
          </div>
        )}
      </div>
      <ResizableSplit
        direction={-1}
        label={copy.timelineSplit}
        onChange={(size) => layout.set("timeline", size)}
        onReset={() => layout.reset("timeline")}
        orientation="horizontal"
        spec={PANEL_SPECS.timeline}
        value={timeline}
      />
      <div className="shrink-0" style={{ height: timeline.size }}>
        <TimelinePanel clock={clock} editor={editor} ref={timelineRef} />
      </div>
      <ShortcutsDialog onOpenChange={setShortcutsOpen} open={shortcutsOpen} />
    </div>
  );
}
