"use client";

import { BOARD_NODE_KINDS, type BoardNode } from "@calcom/product-video/storyboard/board-schema";
import { TRANSITION_KINDS, type TransitionKind } from "@calcom/product-video/storyboard/storyboard-schema";
import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuPopup,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubPopup,
  ContextMenuSubTrigger,
} from "@coss/ui/components/context-menu";
import type * as React from "react";
import { MenuShortcut } from "../menu-shortcut";
import { SCENE_ICONS } from "./scene-node";
import type { StoryboardActions } from "./use-storyboard-actions";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.storyboard;

export type StoryboardMenuTarget =
  | { kind: "node"; nodeId: string }
  | { kind: "edge"; edgeId: string }
  | { kind: "pane"; position: BoardNode["position"] };

/** What was right-clicked: a node or edge by React Flow's `data-id`, an edge by its label pill, else the pane. */
export function menuTargetFrom(
  element: Element | null,
  position: BoardNode["position"]
): StoryboardMenuTarget {
  const pill = element?.closest<HTMLElement>("[data-board-edge]")?.dataset.boardEdge;
  if (pill) return { kind: "edge", edgeId: pill };
  const edgeId = element?.closest<HTMLElement>(".react-flow__edge")?.dataset.id;
  if (edgeId) return { kind: "edge", edgeId };
  const nodeId = element?.closest<HTMLElement>(".react-flow__node")?.dataset.id;
  if (nodeId) return { kind: "node", nodeId };
  return { kind: "pane", position };
}

function KindItems({ onPick }: { onPick: (kind: BoardNode["kind"]) => void }): React.ReactElement {
  return (
    <>
      {BOARD_NODE_KINDS.map((kind) => {
        const Icon = SCENE_ICONS[kind];
        return (
          <ContextMenuItem key={kind} onClick={() => onPick(kind)}>
            <Icon aria-hidden="true" />
            {copy.kinds[kind]}
          </ContextMenuItem>
        );
      })}
    </>
  );
}

type StoryboardContextMenuProps = {
  target: StoryboardMenuTarget | null;
  actions: StoryboardActions;
  canRegenerate: boolean;
  onRegenerate: (nodeId: string) => void;
};

export function StoryboardContextMenu({
  target,
  actions,
  canRegenerate,
  onRegenerate,
}: StoryboardContextMenuProps): React.ReactElement {
  const { board } = actions;
  const node =
    target?.kind === "node" ? board.nodes.find((candidate) => candidate.id === target.nodeId) : null;
  const edge =
    target?.kind === "edge" ? board.edges.find((candidate) => candidate.id === target.edgeId) : null;

  return (
    <ContextMenuPopup className="min-w-52">
      {target?.kind === "pane" ? (
        <>
          <ContextMenuSub>
            <ContextMenuSubTrigger>{copy.menu.add}</ContextMenuSubTrigger>
            <ContextMenuSubPopup>
              <KindItems onPick={(kind) => actions.add(kind, null, target.position)} />
            </ContextMenuSubPopup>
          </ContextMenuSub>
          <ContextMenuItem disabled={!actions.canPaste} onClick={actions.paste}>
            {copy.menu.paste}
            <MenuShortcut action="paste" />
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem disabled={board.nodes.length === 0} onClick={actions.selectAll}>
            {copy.menu.selectAll}
            <MenuShortcut action="select-all" />
          </ContextMenuItem>
          <ContextMenuItem disabled={board.nodes.length === 0} onClick={actions.layout}>
            {copy.autoLayout}
          </ContextMenuItem>
        </>
      ) : null}

      {node ? (
        <>
          <ContextMenuSub>
            <ContextMenuSubTrigger>{copy.menu.addAfter}</ContextMenuSubTrigger>
            <ContextMenuSubPopup>
              <KindItems onPick={(kind) => actions.add(kind, node.id)} />
            </ContextMenuSubPopup>
          </ContextMenuSub>
          <ContextMenuItem onClick={() => actions.duplicate()}>
            {copy.menu.duplicate}
            <MenuShortcut action="duplicate" />
          </ContextMenuItem>
          <ContextMenuItem onClick={() => actions.copy()}>
            {copy.menu.copy}
            <MenuShortcut action="copy" />
          </ContextMenuItem>
          <ContextMenuItem disabled={!actions.canPaste} onClick={actions.paste}>
            {copy.menu.paste}
            <MenuShortcut action="paste" />
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => actions.reorder(node.id, -1)}>{copy.menu.moveUp}</ContextMenuItem>
          <ContextMenuItem onClick={() => actions.reorder(node.id, 1)}>{copy.menu.moveDown}</ContextMenuItem>
          {node.kind === "recording" ? (
            <ContextMenuCheckboxItem
              checked={node.startFrom === "previous"}
              onCheckedChange={(checked) =>
                actions.updateNode(node.id, (current) =>
                  current.kind === "recording"
                    ? { ...current, startFrom: checked ? "previous" : "fresh" }
                    : current
                )
              }>
              {copy.menu.startFromPrevious}
            </ContextMenuCheckboxItem>
          ) : null}
          <ContextMenuSeparator />
          <ContextMenuItem disabled={!canRegenerate} onClick={() => onRegenerate(node.id)}>
            {copy.menu.regenerate}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => actions.remove()} variant="destructive">
            {copy.menu.delete}
            <MenuShortcut action="delete-selection" />
          </ContextMenuItem>
        </>
      ) : null}

      {edge ? (
        <>
          <ContextMenuSub>
            <ContextMenuSubTrigger>{copy.edge.kind}</ContextMenuSubTrigger>
            <ContextMenuSubPopup>
              <ContextMenuRadioGroup
                onValueChange={(value: TransitionKind) =>
                  actions.updateEdge(edge.id, (current) => ({ ...current, transition: value }))
                }
                value={edge.transition}>
                {TRANSITION_KINDS.map((kind) => (
                  <ContextMenuRadioItem key={kind} value={kind}>
                    {STUDIO_COPY.transitions[kind]}
                  </ContextMenuRadioItem>
                ))}
              </ContextMenuRadioGroup>
            </ContextMenuSubPopup>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => actions.remove({ nodeIds: [], edgeIds: [edge.id] })}
            variant="destructive">
            {copy.menu.removeConnection}
          </ContextMenuItem>
        </>
      ) : null}
    </ContextMenuPopup>
  );
}
