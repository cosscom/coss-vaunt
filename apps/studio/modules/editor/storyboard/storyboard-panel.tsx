"use client";

import type { FileAsset } from "@calcom/product-video/project-store/project-assets";
import { boardIssues } from "@calcom/product-video/storyboard/board-edits";
import { Badge } from "@coss/ui/components/badge";
import { Dialog, DialogPopup, DialogTitle } from "@coss/ui/components/dialog";
import { toastManager } from "@coss/ui/components/toast";
import type * as React from "react";
import { useState } from "react";
import { InspectorSection } from "../inspector/inspector-section";
import { useMediaImport } from "../media/use-media-import";
import type { EditorState } from "../use-editor-state";
import type { NodeGeneration } from "./generation-stream";
import { SceneForm } from "./scene-form";
import { StoryboardCanvas } from "./storyboard-canvas";
import { StoryboardComposer } from "./storyboard-composer";
import { useBoardDraft } from "./use-board-draft";
import { useBoardGeneration } from "./use-board-generation";
import { type StoryboardActions, useStoryboardActions } from "./use-storyboard-actions";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.storyboard;

type SceneDetailsProps = {
  actions: StoryboardActions;
  statuses: Record<string, NodeGeneration>;
  files: readonly FileAsset[];
  onUpload: (files: File[]) => Promise<string | null>;
  uploading: boolean;
};

function SceneDetails({
  actions,
  statuses,
  files,
  onUpload,
  uploading,
}: SceneDetailsProps): React.ReactElement | null {
  const node = actions.selectedNode;
  if (!node) return null;
  return (
    <InspectorSection
      aside={<Badge variant="outline">{copy.kinds[node.kind]}</Badge>}
      bodyClassName="gap-3"
      title={node.title}>
      <SceneForm
        actions={actions}
        files={files}
        generation={statuses[node.id]}
        key={node.id}
        node={node}
        onUpload={onUpload}
        uploading={uploading}
      />
    </InspectorSection>
  );
}

/**
 * The left sidebar's storyboard: the canvas, the selected scene's fields and the agent composer. Full screen shows the
 * same board over the editor with the fields docked beside it.
 */
export function StoryboardPanel({
  editor,
  files,
  onAssetsChanged,
}: {
  editor: EditorState;
  /** Imported video and images, for media scenes. */
  files: readonly FileAsset[];
  onAssetsChanged: () => void;
}): React.ReactElement {
  const { project } = editor;
  const actions = useStoryboardActions(editor);
  const generation = useBoardGeneration(project, editor.applyGeneratedClips);
  const drafting = useBoardDraft(project.id);
  const media = useMediaImport(project.id);
  const [fullScreen, setFullScreen] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const issues = boardIssues(actions.board);

  const upload = async (picked: File[]) => {
    const [clip] = await media.importFiles(picked);
    onAssetsChanged();
    return clip && (clip.source.kind === "import" || clip.source.kind === "image") ? clip.source.file : null;
  };
  const canvasProps = {
    actions,
    statuses: generation.statuses,
    issues,
    canRegenerate: !generation.running && issues.length === 0,
    onRegenerate: (nodeId: string) => void generation.generate(actions.board, [nodeId]),
    fitSignal,
  };
  const details = {
    actions,
    statuses: generation.statuses,
    files,
    onUpload: upload,
    uploading: media.importing,
  };

  return (
    <div className="flex flex-1 flex-col">
      <StoryboardCanvas
        {...canvasProps}
        className="min-h-[220px] flex-1"
        fit="width"
        fullScreen={false}
        onToggleFullScreen={() => setFullScreen(true)}
      />
      <SceneDetails {...details} />
      <StoryboardComposer
        board={actions.board}
        drafting={drafting.drafting}
        generating={generation.running}
        issues={issues}
        onBriefChange={actions.setBrief}
        onDraft={async (request) => {
          const board = await drafting.draft(request);
          if (!board) return;
          actions.replace(board);
          setFitSignal((value) => value + 1);
        }}
        onGenerate={() => void generation.generate(actions.board)}
        onReviseScene={async (nodeId, instruction) => {
          const board = actions.board;
          const revised = await drafting.draft({
            prompt: instruction,
            totalSeconds: board.nodes.reduce((sum, node) => sum + node.duration, 0),
            board,
            focusNodeId: nodeId,
          });
          if (!revised) return false;
          const scene = revised.nodes.find((node) => node.id === nodeId);
          if (!scene) {
            toastManager.add({
              type: "error",
              title: copy.prompt.reviseFailed,
              description: copy.prompt.sceneDropped,
            });
            return false;
          }
          // Only the scene in context changes, whatever else the agent touched.
          actions.updateNode(nodeId, (current) => ({ ...scene, position: current.position }));
          return true;
        }}
        onStop={drafting.stop}
        onThemeChange={(theme) => editor.updateSettings({ theme })}
        selectedNode={actions.selectedNode}
        theme={project.settings.theme}
      />
      <Dialog onOpenChange={setFullScreen} open={fullScreen}>
        <DialogPopup
          bottomStickOnMobile={false}
          className="row-span-3 row-start-1 h-full max-w-none flex-row overflow-hidden"
          showCloseButton={false}>
          <DialogTitle className="sr-only">{copy.tab}</DialogTitle>
          <StoryboardCanvas
            {...canvasProps}
            className="min-w-0 flex-1"
            fit="all"
            fullScreen
            onToggleFullScreen={() => setFullScreen(false)}
          />
          <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-s">
            {actions.selectedNode ? (
              <SceneDetails {...details} />
            ) : (
              <p className="p-4 text-muted-foreground text-sm">{copy.selectHint}</p>
            )}
          </aside>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
