"use client";

import {
  type BoardSegment,
  connectBoardNodes,
  copyBoardSegment,
  createBoardNode,
  duplicateBoardNodes,
  insertBoardNode,
  insertBoardSegment,
  layoutBoard,
  moveBoardNodes,
  removeBoardNodes,
  updateBoardEdge,
  updateBoardNode,
} from "@coss/vaunt-engine/storyboard/board-edits";
import { boardOrder } from "@coss/vaunt-engine/storyboard/board-order";
import type { Board, BoardEdge, BoardNode, BoardNodeKind } from "@coss/vaunt-engine/storyboard/board-schema";
import { reorderScene } from "@coss/vaunt-engine/storyboard/board-sync";
import { useState } from "react";
import type { EditorState } from "../use-editor-state";
import { type BoardSelection, EMPTY_BOARD_SELECTION } from "./board-flow";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.storyboard;

function pruned(selection: BoardSelection, board: Board): BoardSelection {
  const nodeIds = selection.nodeIds.filter((id) => board.nodes.some((node) => node.id === id));
  const edgeIds = selection.edgeIds.filter((id) => board.edges.some((edge) => edge.id === id));
  return nodeIds.length === selection.nodeIds.length && edgeIds.length === selection.edgeIds.length
    ? selection
    : { nodeIds, edgeIds };
}

/** Board edits and the canvas selection, shared by the sidebar canvas, full screen and the menus. */
export function useStoryboardActions(editor: EditorState) {
  const { board } = editor;
  const [rawSelection, setSelection] = useState<BoardSelection>(EMPTY_BOARD_SELECTION);
  const [clipboard, setClipboard] = useState<BoardSegment | null>(null);
  const selection = pruned(rawSelection, board);
  const single = selection.nodeIds.length === 1 ? selection.nodeIds[0] : null;
  const selectNodes = (nodeIds: string[]) => setSelection({ nodeIds, edgeIds: [] });
  const lastSelected = () =>
    boardOrder(board)
      .filter((node) => selection.nodeIds.includes(node.id))
      .at(-1)?.id ?? null;

  const add = (kind: BoardNodeKind, afterId: string | null = lastSelected(), at?: BoardNode["position"]) => {
    const node = createBoardNode(kind, { title: copy.newTitles[kind] });
    editor.editBoard((current) => insertBoardNode(current, node, afterId, { at }));
    selectNodes([node.id]);
    return node.id;
  };

  return {
    board,
    selection,
    selectedNode: single ? (board.nodes.find((node) => node.id === single) ?? null) : null,
    canPaste: clipboard !== null && clipboard.nodes.length > 0,
    setSelection,
    selectNodes,
    selectAll: () => setSelection({ nodeIds: board.nodes.map((node) => node.id), edgeIds: [] }),
    clearSelection: () => setSelection(EMPTY_BOARD_SELECTION),

    add,
    remove: (target: BoardSelection = selection) => {
      // The sync takes a scene's clips with it, and turns a deleted join between two scenes into a cut.
      editor.editBoard((current) => removeBoardNodes(current, target.nodeIds, target.edgeIds));
      setSelection(EMPTY_BOARD_SELECTION);
    },
    duplicate: (nodeIds: string[] = selection.nodeIds) => {
      if (nodeIds.length === 0) return;
      const result = duplicateBoardNodes(board, nodeIds);
      editor.editBoard(() => result.board);
      selectNodes(result.nodeIds);
    },
    copy: (nodeIds: string[] = selection.nodeIds) => {
      if (nodeIds.length > 0) setClipboard(copyBoardSegment(board, nodeIds));
    },
    paste: () => {
      if (!clipboard) return;
      // Fresh ids on every paste, so pasting twice doesn't collide.
      const fresh = copyBoardSegment(
        { ...board, ...clipboard },
        clipboard.nodes.map((node) => node.id)
      );
      editor.editBoard((current) => insertBoardSegment(current, fresh, lastSelected()));
      selectNodes(fresh.nodes.map((node) => node.id));
    },
    connect: (from: string, to: string) =>
      editor.editBoard((current) => connectBoardNodes(current, from, to)),
    reorder: (nodeId: string, direction: -1 | 1) =>
      editor.editScenes((current) => reorderScene(current, nodeId, direction)),
    layout: () => editor.editBoard(layoutBoard),
    move: (positions: Record<string, BoardNode["position"]>) =>
      editor.editBoard((current) => moveBoardNodes(current, positions), "board-move"),
    updateNode: (nodeId: string, update: (node: BoardNode) => BoardNode, group?: string) =>
      editor.editBoard((current) => updateBoardNode(current, nodeId, update), group),
    updateEdge: (edgeId: string, update: (edge: BoardEdge) => BoardEdge, group?: string) =>
      editor.editBoard((current) => updateBoardEdge(current, edgeId, update), group),
    setBrief: (brief: string) => editor.editBoard((current) => ({ ...current, brief }), "board-brief"),
    replace: (next: Board) => {
      editor.editBoard(() => next, undefined, { replace: true });
      setSelection(EMPTY_BOARD_SELECTION);
    },
  };
}

export type StoryboardActions = ReturnType<typeof useStoryboardActions>;
