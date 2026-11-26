"use client";

import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import { Dialog, DialogPopup, DialogTitle } from "@coss/ui/components/dialog";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { SparklesIcon } from "@coss/ui/icons";
import type { FileAsset } from "@coss/vaunt-engine/project-store/project-assets";
import { type BoardIssue, boardIssues } from "@coss/vaunt-engine/storyboard/board-edits";
import type { Board } from "@coss/vaunt-engine/storyboard/board-schema";
import type * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { InspectorSection } from "../inspector/inspector-section";
import { useMediaImport } from "../media/use-media-import";
import { exampleBoard } from "./example-board";
import type { NodeGeneration } from "./generation-stream";
import { SceneForm } from "./scene-form";
import { StoryboardCanvas } from "./storyboard-canvas";
import { StoryboardEmpty } from "./storyboard-empty";
import type { BoardGeneration } from "./use-board-generation";
import type { StoryboardActions } from "./use-storyboard-actions";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.storyboard;
const EXAMPLE = exampleBoard();

export function issueMessage(issue: BoardIssue, board: Board): string {
  const title = (nodeId: string) => board.nodes.find((node) => node.id === nodeId)?.title ?? "";
  switch (issue.code) {
    case "empty":
      return copy.issues.empty;
    case "invalid":
      return copy.issues.invalid;
    case "unknown-route":
      return copy.issues.unknownRoute(title(issue.nodeId));
    case "missing-file":
      return copy.issues.missingFile(title(issue.nodeId));
  }
}

/** Bumps when the board is replaced wholesale (a draft, an undo of one), so the canvas fits the view to it. */
function useReplacedSignal(board: Board): number {
  const [signal, setSignal] = useState(0);
  const previous = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(board.nodes.map((node) => node.id));
    const before = previous.current;
    previous.current = ids;
    if (!before || ids.size === 0) return;
    if (![...ids].some((id) => before.has(id))) setSignal((value) => value + 1);
  }, [board]);
  return signal;
}

type SceneDetailsProps = {
  projectId: string;
  actions: StoryboardActions;
  statuses: Record<string, NodeGeneration>;
  files: readonly FileAsset[];
  onUpload: (files: File[]) => Promise<string | null>;
  uploading: boolean;
};

function SceneDetails({
  projectId,
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
      aside={<Badge variant="secondary">{copy.kinds[node.kind]}</Badge>}
      bodyClassName="gap-3"
      title={node.title}>
      <SceneForm
        actions={actions}
        files={files}
        generation={statuses[node.id]}
        key={node.id}
        node={node}
        onUpload={onUpload}
        projectId={projectId}
        uploading={uploading}
      />
    </InspectorSection>
  );
}

/**
 * The left sidebar's storyboard: the canvas and the selected scene's fields, with Generate under them. Before there
 * are scenes it shows an example board and how to get one. Full screen shows the same board over the editor with the
 * fields docked beside it. The agent drafts and revises the board; only Generate here, or on the agent's card, records.
 */
export function StoryboardPanel({
  projectId,
  actions,
  generation,
  files,
  onAssetsChanged,
  onPlanWithAgent,
}: {
  projectId: string;
  actions: StoryboardActions;
  generation: BoardGeneration;
  /** Imported video and images, for media scenes. */
  files: readonly FileAsset[];
  onAssetsChanged: () => void;
  onPlanWithAgent: () => void;
}): React.ReactElement {
  const media = useMediaImport(projectId);
  const [fullScreen, setFullScreen] = useState(false);
  const fitSignal = useReplacedSignal(actions.board);
  const issues = useMemo(() => boardIssues(actions.board), [actions.board]);
  const scenes = actions.board.nodes.length;

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
    projectId,
    actions,
    statuses: generation.statuses,
    files,
    onUpload: upload,
    uploading: media.importing,
  };

  if (scenes === 0)
    return (
      <StoryboardEmpty
        canvas={
          <StoryboardCanvas
            {...canvasProps}
            actions={{ ...actions, board: EXAMPLE }}
            className="min-h-[220px] flex-1"
            fit="width"
            fullScreen={false}
            onToggleFullScreen={() => setFullScreen(true)}
          />
        }
        onAddScene={(kind) => actions.add(kind)}
        onPlanWithAgent={onPlanWithAgent}
      />
    );

  const totalSeconds = actions.board.nodes.reduce((sum, node) => sum + node.duration, 0);
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
      <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t bg-background p-3">
        <div className="flex gap-2">
          <Button
            className="min-w-0 flex-1"
            disabled={issues.length > 0}
            loading={generation.running}
            onClick={() => void generation.generate(actions.board)}>
            {copy.prompt.generate}
            <span className="font-normal tabular-nums opacity-64">
              {copy.prompt.summary(scenes, copy.seconds(totalSeconds))}
            </span>
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={copy.askAgent}
                  onClick={onPlanWithAgent}
                  size="icon"
                  variant="secondary"
                />
              }>
              <SparklesIcon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipPopup>{copy.askAgent}</TooltipPopup>
          </Tooltip>
        </div>
        {issues[0] ? (
          <p className="px-1 text-muted-foreground text-xs">{issueMessage(issues[0], actions.board)}</p>
        ) : null}
      </div>
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
