import { BOARD_NODE_SIZE, type BoardIssue } from "@coss/vaunt-engine/storyboard/board-edits";
import type { Board, BoardEdge, BoardNode } from "@coss/vaunt-engine/storyboard/board-schema";
import type { Edge, Node } from "@xyflow/react";
import type { NodeGeneration } from "./generation-stream";

export type BoardSelection = { nodeIds: string[]; edgeIds: string[] };
export const EMPTY_BOARD_SELECTION: BoardSelection = { nodeIds: [], edgeIds: [] };

export type SceneNodeData = {
  scene: BoardNode;
  generation: NodeGeneration | null;
  issue: BoardIssue["code"] | null;
};
export type SceneFlowNode = Node<SceneNodeData, "scene">;
export type TransitionFlowEdge = Edge<{ edge: BoardEdge }, "transition">;

type Measured = Record<string, { width?: number; height?: number } | undefined>;

/**
 * How far each node is drawn below its saved position: a card that grows past its usual height (while the agent
 * lists its steps) pushes down every card beneath it that it would otherwise cover. Saved positions never change.
 */
export function growthOffsets(board: Board, measured: Measured): Record<string, number> {
  const growth = board.nodes.flatMap((node) => {
    const extra = (measured[node.id]?.height ?? BOARD_NODE_SIZE.height) - BOARD_NODE_SIZE.height;
    return extra > 0.5 ? [{ node, extra }] : [];
  });
  return Object.fromEntries(
    board.nodes.map((node) => [
      node.id,
      growth
        .filter(
          ({ node: above }) =>
            above.position.y < node.position.y &&
            Math.abs(above.position.x - node.position.x) < BOARD_NODE_SIZE.width
        )
        .reduce((sum, { extra }) => sum + extra, 0),
    ])
  );
}

/** React Flow's controlled nodes for the board; sizes it measured are carried over so nodes stay visible. */
export function toFlowNodes(
  board: Board,
  {
    selection,
    generation,
    issues,
    measured,
  }: {
    selection: BoardSelection;
    generation: Record<string, NodeGeneration>;
    issues: readonly BoardIssue[];
    measured: Measured;
  }
): SceneFlowNode[] {
  const issueFor = new Map(
    issues.flatMap((issue) => ("nodeId" in issue ? [[issue.nodeId, issue.code] as const] : []))
  );
  const offsets = growthOffsets(board, measured);
  return board.nodes.map((scene) => ({
    id: scene.id,
    type: "scene",
    // The card shows React Flow's keyboard focus on the node wrapper.
    className: "group/node",
    position: { x: scene.position.x, y: scene.position.y + (offsets[scene.id] ?? 0) },
    selected: selection.nodeIds.includes(scene.id),
    measured: measured[scene.id],
    data: { scene, generation: generation[scene.id] ?? null, issue: issueFor.get(scene.id) ?? null },
  }));
}

export function toFlowEdges(board: Board, selection: BoardSelection): TransitionFlowEdge[] {
  return board.edges.map((edge) => ({
    id: edge.id,
    type: "transition",
    source: edge.from,
    target: edge.to,
    selected: selection.edgeIds.includes(edge.id),
    data: { edge },
  }));
}

/** Selection after React Flow reports select changes; null when nothing in the batch changed it. */
export function applySelectChanges(
  current: readonly string[],
  changes: readonly { type: string; id?: string; selected?: boolean }[]
): string[] | null {
  const selects = changes.filter(
    (change): change is { type: "select"; id: string; selected: boolean } =>
      change.type === "select" && typeof change.id === "string"
  );
  if (selects.length === 0) return null;
  const next = new Set(current);
  for (const change of selects) {
    if (change.selected) next.add(change.id);
    else next.delete(change.id);
  }
  return [...next];
}

type Viewport = { x: number; y: number; zoom: number };

/**
 * Fits the board's width to the canvas and anchors its top, without shrinking to fit the height: in the
 * narrow sidebar that would leave cards too small to read, so the rest of the board is a scroll away.
 */
export function widthFitViewport(
  nodes: readonly { position: { x: number; y: number } }[],
  nodeSize: { width: number; height: number },
  canvasWidth: number,
  { maxZoom, minZoom, inset, top }: { maxZoom: number; minZoom: number; inset: number; top: number }
): Viewport {
  if (nodes.length === 0 || canvasWidth <= 0) return { x: inset, y: top, zoom: maxZoom };
  const left = Math.min(...nodes.map((node) => node.position.x));
  const right = Math.max(...nodes.map((node) => node.position.x + nodeSize.width));
  const upper = Math.min(...nodes.map((node) => node.position.y));
  const zoom = Math.min(maxZoom, Math.max(minZoom, (canvasWidth - inset * 2) / (right - left)));
  return { x: (canvasWidth - (right - left) * zoom) / 2 - left * zoom, y: top - upper * zoom, zoom };
}
