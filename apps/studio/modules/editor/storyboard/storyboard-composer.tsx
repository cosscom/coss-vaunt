"use client";

import { AgentComposer } from "@calcom/ai/react/ui/agent-composer";
import type { BoardIssue } from "@calcom/product-video/storyboard/board-edits";
import type { Board, BoardNode } from "@calcom/product-video/storyboard/board-schema";
import type { ProjectSettings } from "@calcom/product-video/storyboard/storyboard-schema";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@coss/ui/components/alert-dialog";
import { Button } from "@coss/ui/components/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@coss/ui/components/select";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { MoonIcon, SunIcon, XIcon } from "@coss/ui/icons";
import { SegmentedRadio, SegmentedRadioGroup } from "@coss/ui/shared/segmented-radio-group";
import type * as React from "react";
import { useState } from "react";
import { SCENE_ICONS } from "./scene-node";
import type { DraftRequest } from "./use-board-draft";
import { BorderBeam } from "@/modules/border-beam/border-beam";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.storyboard.prompt;
const LENGTHS = [15, 20, 30, 45, 60].map((value) => ({ value, label: `${value} s` }));

export function issueMessage(issue: BoardIssue, board: Board): string {
  const title = (nodeId: string) => board.nodes.find((node) => node.id === nodeId)?.title ?? "";
  switch (issue.code) {
    case "empty":
      return STUDIO_COPY.storyboard.issues.empty;
    case "invalid":
      return STUDIO_COPY.storyboard.issues.invalid;
    case "unknown-route":
      return STUDIO_COPY.storyboard.issues.unknownRoute(title(issue.nodeId));
    case "missing-file":
      return STUDIO_COPY.storyboard.issues.missingFile(title(issue.nodeId));
  }
}

function IconButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            className={className}
            onClick={onClick}
            size="icon-xs"
            type="button"
            variant="ghost"
          />
        }>
        {children}
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

type StoryboardComposerProps = {
  board: Board;
  issues: readonly BoardIssue[];
  /** The selected scene becomes the composer's context: what's typed then revises that scene. */
  selectedNode: BoardNode | null;
  theme: ProjectSettings["theme"];
  onThemeChange: (theme: ProjectSettings["theme"]) => void;
  onBriefChange: (brief: string) => void;
  onDraft: (request: DraftRequest) => void;
  /** Resolves true once the scene is revised, so the instruction can clear. */
  onReviseScene: (nodeId: string, instruction: string) => Promise<boolean>;
  onStop: () => void;
  onGenerate: () => void;
  drafting: boolean;
  generating: boolean;
};

/**
 * The agent composer under the board. With no scene in context it holds the brief and drafts the board; with one,
 * it takes an instruction for that scene. Generate is the panel's one primary action once there's a board.
 */
export function StoryboardComposer({
  board,
  issues,
  selectedNode,
  theme,
  onThemeChange,
  onBriefChange,
  onDraft,
  onReviseScene,
  onStop,
  onGenerate,
  drafting,
  generating,
}: StoryboardComposerProps): React.ReactElement {
  const [lengthSeconds, setLengthSeconds] = useState(30);
  const [confirming, setConfirming] = useState(false);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [instruction, setInstruction] = useState({ nodeId: "", text: "" });
  const scenes = board.nodes.length;
  const scene = selectedNode && selectedNode.id !== dismissedId ? selectedNode : null;
  const sceneInstruction = scene && instruction.nodeId === scene.id ? instruction.text : "";
  const totalSeconds = board.nodes.reduce((sum, node) => sum + node.duration, 0);

  const draftRequest = (): DraftRequest => ({
    prompt: board.brief,
    totalSeconds: lengthSeconds,
    ...(scenes > 0 ? { board } : {}),
  });
  const submit = async () => {
    if (scene) {
      if (await onReviseScene(scene.id, sceneInstruction)) setInstruction({ nodeId: "", text: "" });
      return;
    }
    if (scenes > 0) setConfirming(true);
    else onDraft(draftRequest());
  };

  let sendLabel: string = copy.draft;
  if (scene) sendLabel = copy.revise;
  else if (scenes > 0) sendLabel = copy.redraft;

  let header: React.ReactNode;
  if (scene) {
    const Icon = SCENE_ICONS[scene.kind];
    header = (
      <div className="flex w-full min-w-0 items-center gap-2 px-1">
        <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium text-muted-foreground text-xs">
          {scene.title}
        </span>
        <IconButton
          className="shrink-0 text-muted-foreground hover:text-foreground"
          label={copy.removeContext}
          onClick={() => setDismissedId(scene.id)}>
          <XIcon aria-hidden="true" />
        </IconButton>
      </div>
    );
  }

  let reattach: React.ReactNode = null;
  if (selectedNode && !scene) {
    const Icon = SCENE_ICONS[selectedNode.kind];
    reattach = (
      <IconButton className="rounded-full" label={copy.useSceneContext} onClick={() => setDismissedId(null)}>
        <Icon aria-hidden="true" />
      </IconButton>
    );
  }

  return (
    <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t bg-background p-3">
      <BorderBeam state={drafting || generating ? "active" : "idle"}>
        <AgentComposer
          autoFocus={false}
          disabled={generating}
          header={header}
          headerOpen={scene !== null}
          inputLabel={scene ? copy.revise : copy.label}
          isBusy={drafting}
          leadingActions={
            <>
              {reattach}
              {scene ? null : (
                <Select
                  items={LENGTHS}
                  onValueChange={(value) => value && setLengthSeconds(value)}
                  value={lengthSeconds}>
                  <SelectTrigger
                    aria-label={copy.length}
                    className="w-auto min-w-0 border-transparent tabular-nums shadow-none"
                    size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {LENGTHS.map((item) => (
                      <SelectItem className="tabular-nums" key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              )}
              {scene ? null : (
                <SegmentedRadioGroup
                  aria-label={STUDIO_COPY.editor.videoTheme}
                  onValueChange={(value) => {
                    if (value === "light" || value === "dark") onThemeChange(value);
                  }}
                  size="sm"
                  value={theme}>
                  <SegmentedRadio aria-label={STUDIO_COPY.editor.light} value="light">
                    <SunIcon aria-hidden="true" />
                  </SegmentedRadio>
                  <SegmentedRadio aria-label={STUDIO_COPY.editor.dark} value="dark">
                    <MoonIcon aria-hidden="true" />
                  </SegmentedRadio>
                </SegmentedRadioGroup>
              )}
            </>
          }
          onStop={onStop}
          onSubmit={() => void submit()}
          onValueChange={(text) => {
            if (scene) setInstruction({ nodeId: scene.id, text });
            else onBriefChange(text);
          }}
          placeholder={scene ? copy.scenePlaceholder : copy.placeholder}
          rows={2}
          sendLabel={sendLabel}
          stopLabel={copy.stop}
          value={scene ? sceneInstruction : board.brief}
        />
      </BorderBeam>
      {scenes > 0 ? (
        <Button
          className="w-full"
          disabled={issues.length > 0 || drafting}
          loading={generating}
          onClick={onGenerate}>
          {copy.generate}
          <span className="font-normal tabular-nums opacity-64">
            {copy.summary(scenes, STUDIO_COPY.storyboard.seconds(totalSeconds))}
          </span>
        </Button>
      ) : null}
      {issues[0] && scenes > 0 ? (
        <p className="px-1 text-muted-foreground text-xs">{issueMessage(issues[0], board)}</p>
      ) : null}
      <AlertDialog onOpenChange={setConfirming} open={confirming}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.replaceTitle}</AlertDialogTitle>
            <AlertDialogDescription>{copy.replaceDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>{copy.cancel}</AlertDialogClose>
            <Button
              onClick={() => {
                setConfirming(false);
                onDraft(draftRequest());
              }}>
              {copy.replace}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  );
}
