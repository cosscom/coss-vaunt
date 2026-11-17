"use client";

import { findRouteEntry, isAppPath } from "@calcom/product-video/catalogues/routes/route-catalogue";
import { BOARD_NODE_SIZE } from "@calcom/product-video/storyboard/board-edits";
import type { BoardNode, BoardNodeKind } from "@calcom/product-video/storyboard/board-schema";
import { Badge } from "@coss/ui/components/badge";
import { CaptionsIcon, CircleAlertIcon, CornerDownRightIcon, MonitorIcon, VideoIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import type * as React from "react";
import type { SceneFlowNode } from "./board-flow";
import type { GenerationStatus } from "./generation-stream";
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
    return { text: findRouteEntry(scene.route)?.label ?? scene.route, missing: false, error: false };
  }
  if (scene.kind === "text")
    return scene.words.trim()
      ? { text: scene.words, missing: false, error: false }
      : { text: copy.noWords, missing: true, error: false };
  return scene.file
    ? { text: fileLabel(scene.file), missing: false, error: false }
    : { text: copy.noFile, missing: true, error: false };
}

export function SceneNode({ data, selected }: NodeProps<SceneFlowNode>): React.ReactElement {
  const { scene, generation, issue } = data;
  const Icon = SCENE_ICONS[scene.kind];
  const summary = summaryOf(scene);

  // While generating, the line shows the agent's latest step, or why the scene failed.
  const progress = generation?.message && generation.status !== "done" ? generation.message : null;
  const line = progress ?? summary.text;
  const error = generation?.status === "failed" || (!progress && summary.error);

  return (
    <div
      className={cn(
        "relative flex flex-col justify-center gap-1 rounded-xl border bg-card px-3 text-card-foreground shadow-xs/5 transition-[box-shadow,border-color] not-dark:bg-clip-padding",
        "group-focus-visible/node:ring-2 group-focus-visible/node:ring-ring group-focus-visible/node:ring-offset-1 group-focus-visible/node:ring-offset-background",
        selected && "border-ring shadow-sm/5 ring-2 ring-ring/24",
        issue && !selected && "border-destructive/48"
      )}
      data-board-node=""
      style={{ width: BOARD_NODE_SIZE.width, height: BOARD_NODE_SIZE.height }}>
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
        {generation ? (
          <Badge className="shrink-0" size="sm" variant={STATUS_BADGES[generation.status]}>
            {copy.status[generation.status]}
          </Badge>
        ) : null}
      </div>
      <Handle className={HANDLE} position={Position.Bottom} type="source" />
    </div>
  );
}
