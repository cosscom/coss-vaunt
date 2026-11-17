"use client";

import { ROUTE_CATALOGUE } from "@calcom/product-video/catalogues/routes/route-catalogue";
import type { BoardIssue } from "@calcom/product-video/storyboard/board-edits";
import type { Board } from "@calcom/product-video/storyboard/board-schema";
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
import { Field, FieldLabel } from "@coss/ui/components/field";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@coss/ui/components/select";
import { Slider } from "@coss/ui/components/slider";
import { SparklesIcon } from "@coss/ui/icons";
import type * as React from "react";
import { useState } from "react";
import { DraftTextarea } from "../inspector/draft-text-field";
import { InspectorSection } from "../inspector/inspector-section";
import type { DraftRequest } from "./use-board-draft";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.storyboard.prompt;
const MIN_LENGTH_SECONDS = 12;
const MAX_LENGTH_SECONDS = 60;
const MAX_BRIEF_LENGTH = 4000;
const routeItems = ROUTE_CATALOGUE.map((entry) => ({ value: entry.route, label: entry.label }));

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

type StoryboardPromptProps = {
  board: Board;
  issues: readonly BoardIssue[];
  onBriefChange: (brief: string) => void;
  onDraft: (request: DraftRequest) => void;
  onGenerate: () => void;
  drafting: boolean;
  generating: boolean;
};

export function StoryboardPrompt({
  board,
  issues,
  onBriefChange,
  onDraft,
  onGenerate,
  drafting,
  generating,
}: StoryboardPromptProps): React.ReactElement {
  const [routes, setRoutes] = useState<string[]>(routeItems.map((item) => item.value));
  const [lengthSeconds, setLengthSeconds] = useState(30);
  const [confirming, setConfirming] = useState(false);
  const request = (): DraftRequest => ({
    prompt: board.brief,
    routes,
    totalSeconds: lengthSeconds,
    ...(board.nodes.length > 0 ? { board } : {}),
  });

  // A fragment, so the footer's sticky box is the whole storyboard panel and the buttons stay in view.
  return (
    <>
      <InspectorSection bodyClassName="gap-5" title={copy.section}>
        <Field>
          <FieldLabel className="sr-only" htmlFor="storyboard-brief">
            {copy.label}
          </FieldLabel>
          <DraftTextarea
            allowEmpty
            id="storyboard-brief"
            maxLength={MAX_BRIEF_LENGTH}
            onCommit={onBriefChange}
            placeholder={copy.placeholder}
            value={board.brief}
          />
        </Field>
        <Field>
          <FieldLabel>{copy.routes}</FieldLabel>
          <Select items={routeItems} multiple onValueChange={setRoutes} value={routes}>
            <SelectTrigger size="sm">
              <SelectValue placeholder={copy.routesPlaceholder}>
                {(value: string[]) =>
                  value
                    .map((route) => routeItems.find((item) => item.value === route)?.label ?? route)
                    .join(", ") || copy.routesPlaceholder
                }
              </SelectValue>
            </SelectTrigger>
            <SelectPopup>
              {routeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </Field>
        <Field>
          <div className="flex w-full items-center justify-between">
            <FieldLabel>{copy.length}</FieldLabel>
            <span className="text-muted-foreground text-sm tabular-nums">{lengthSeconds} s</span>
          </div>
          <Slider
            aria-label={copy.length}
            className="[&_[data-slot=slider-control]]:min-w-0"
            max={MAX_LENGTH_SECONDS}
            min={MIN_LENGTH_SECONDS}
            onValueChange={(value) => setLengthSeconds(Array.isArray(value) ? (value[0] ?? 30) : value)}
            step={1}
            value={lengthSeconds}
          />
          <div className="flex w-full justify-between text-muted-foreground text-xs tabular-nums">
            <span>{MIN_LENGTH_SECONDS} s</span>
            <span>{MAX_LENGTH_SECONDS} s</span>
          </div>
        </Field>
      </InspectorSection>
      <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t bg-background p-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            disabled={!board.brief.trim() || routes.length === 0 || generating}
            loading={drafting}
            onClick={() => (board.nodes.length > 0 ? setConfirming(true) : onDraft(request()))}
            variant="outline">
            <SparklesIcon aria-hidden="true" />
            {copy.draft}
          </Button>
          <Button disabled={issues.length > 0 || drafting} loading={generating} onClick={onGenerate}>
            {copy.generate}
          </Button>
        </div>
        {issues[0] && board.nodes.length > 0 ? (
          <p className="text-muted-foreground text-xs">{issueMessage(issues[0], board)}</p>
        ) : null}
      </div>
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
                onDraft(request());
              }}>
              {copy.replace}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}
