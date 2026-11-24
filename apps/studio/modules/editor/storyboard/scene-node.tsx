"use client";

import { Badge } from "@coss/ui/components/badge";
import {
  CaptionsIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CornerDownRightIcon,
  MonitorIcon,
  VideoIcon,
} from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import { isAppPath } from "@coss/vaunt-engine/recording/app-path";
import { BOARD_NODE_SIZE } from "@coss/vaunt-engine/storyboard/board-edits";
import type { BoardNode, BoardNodeKind } from "@coss/vaunt-engine/storyboard/board-schema";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import type { SceneFlowNode } from "./board-flow";
import { type GenerationStatus, type NodeGeneration, shownSteps } from "./generation-stream";
import { SUCCESS_GLOW_MS, sceneBeamState } from "./scene-beam-state";
import { AgentStatusIndicator } from "@/modules/agent-ui/agent-status-indicator";
import { BorderBeam } from "@/modules/border-beam/border-beam";
import { CARD_BEAM } from "@/modules/border-beam/border-beam-engine";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.storyboard;

export const SCENE_ICONS: Record<BoardNodeKind, typeof MonitorIcon> = {
  recording: MonitorIcon,
  text: CaptionsIcon,
  media: VideoIcon,
};

const STATUS_BADGES: Record<GenerationStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  queued: "secondary",
  exploring: "info",
  recording: "info",
  done: "success",
  failed: "error",
};

// React Flow's unlayered base.css sets handle size and colour, so those utilities need `!` to win.
const HANDLE =
  "size-2.5! min-h-0! min-w-0! rounded-full border-2 border-card bg-muted-foreground/64! hover:bg-ring!";

export function fileLabel(file: string): string {
  return (file.split("/").pop() ?? file).replace(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}-/i, "");
}

/** The one-line summary under the title: the route, the words or the file, or what's missing. */
function summaryOf(scene: BoardNode): { text: string; missing: boolean; error: boolean } {
  if (scene.kind === "recording") {
    if (!isAppPath(scene.route))
      return { text: `${copy.unknownRoute} · ${scene.route}`, missing: false, error: true };
    return { text: scene.route, missing: false, error: false };
  }
  if (scene.kind === "text")
    return scene.words.trim()
      ? { text: scene.words, missing: false, error: false }
      : { text: copy.noWords, missing: true, error: false };
  return scene.file
    ? { text: fileLabel(scene.file), missing: false, error: false }
    : { text: copy.noFile, missing: true, error: false };
}

/** The agent's work on this scene, as in the agent chat: finished steps ticked, the current one shimmering. */
function SceneSteps({ generation }: { generation: NodeGeneration }): React.ReactElement | null {
  const { finished, current } = shownSteps(generation);
  if (!current) return null;
  const progress =
    generation.status === "recording" && generation.progress !== undefined
      ? ` · ${Math.round(generation.progress * 100)}%`
      : "";
  return (
    <ol className="flex min-w-0 flex-col gap-1 border-t pt-2">
      {finished.map((step) => (
        <li className="flex min-w-0 items-center gap-1.5 text-muted-foreground/72 text-xs" key={step}>
          <CircleCheckIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate">{step}</span>
        </li>
      ))}
      <li className="flex min-w-0">
        <AgentStatusIndicator announce={false} label={`${current}${progress}`} status="working" />
      </li>
    </ol>
  );
}

/** True for a moment after `status` turns done while mounted; a scene that loads already done never flashes. */
function useJustFinished(status: GenerationStatus | undefined): boolean {
  const previous = useRef(status);
  const [finishing, setFinishing] = useState(false);
  useEffect(() => {
    const was = previous.current;
    previous.current = status;
    if (status !== "done" || was === "done") return;
    setFinishing(true);
    const timer = setTimeout(() => setFinishing(false), SUCCESS_GLOW_MS);
    return () => clearTimeout(timer);
  }, [status]);
  return finishing && status === "done";
}

export function SceneNode({ data, selected }: NodeProps<SceneFlowNode>): React.ReactElement {
  const { scene, generation, issue } = data;
  const Icon = SCENE_ICONS[scene.kind];
  const summary = summaryOf(scene);

  const working = generation?.status === "exploring" || generation?.status === "recording";
  // The line shows why the scene failed; while it works, the steps below say what the agent is doing.
  const progress = generation?.status === "failed" && generation.message ? generation.message : null;
  const line = progress ?? summary.text;
  const error = generation?.status === "failed" || (!progress && summary.error);
  const beam = sceneBeamState(generation?.status, useJustFinished(generation?.status));

  return (
    <BorderBeam options={CARD_BEAM} state={beam}>
      <div
        className={cn(
          "relative flex flex-col justify-center gap-1 rounded-xl border bg-card px-3 text-card-foreground shadow-xs/5 transition-[box-shadow,border-color] not-dark:bg-clip-padding",
          "group-focus-visible/node:ring-2 group-focus-visible/node:ring-ring group-focus-visible/node:ring-offset-1 group-focus-visible/node:ring-offset-background",
          working && "gap-1.5 py-3",
          selected && "border-ring shadow-sm/5 ring-2 ring-ring/24",
          issue && !selected && "border-destructive/48"
        )}
        aria-busy={working || undefined}
        data-board-node=""
        style={
          working
            ? { width: BOARD_NODE_SIZE.width, minHeight: BOARD_NODE_SIZE.height }
            : { width: BOARD_NODE_SIZE.width, height: BOARD_NODE_SIZE.height }
        }>
        <Handle className={HANDLE} position={Position.Top} type="target" />
        <div className="flex min-w-0 items-center gap-2">
          <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-medium text-sm">{scene.title}</span>
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {copy.seconds(scene.duration)}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 ps-6">
          {scene.kind === "recording" && scene.startFrom === "previous" ? (
            <CornerDownRightIcon
              aria-label={copy.form.previous}
              className="size-3 shrink-0 text-muted-foreground"
            />
          ) : null}
          {error ? <CircleAlertIcon aria-hidden="true" className="size-3 shrink-0 text-destructive" /> : null}
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-xs",
              error ? "text-destructive-foreground" : "text-muted-foreground",
              !progress && summary.missing && "text-muted-foreground/72"
            )}
            title={line}>
            {line}
          </span>
          {generation && !working ? (
            <Badge className="shrink-0" size="sm" variant={STATUS_BADGES[generation.status]}>
              {copy.status[generation.status]}
            </Badge>
          ) : null}
        </div>
        {generation ? <SceneSteps generation={generation} /> : null}
        <Handle className={HANDLE} position={Position.Bottom} type="source" />
      </div>
    </BorderBeam>
  );
}
