import { isAppPath } from "../recording/app-path";
import { boardOrder } from "./board-order";
import { type Board, type BoardEdge, type BoardNode, type BoardNodeKind, boardSchema } from "./board-schema";
import type { TransitionKind } from "./storyboard-schema";

/** Layout size of a node card in canvas units; the canvas renders cards at this width. */
export const BOARD_NODE_SIZE = { width: 208, height: 64 };
export const BOARD_ROW_GAP = 48;
const ROW = BOARD_NODE_SIZE.height + BOARD_ROW_GAP;

export const DEFAULT_BOARD_TRANSITION: { transition: TransitionKind; transitionSeconds: number } = {
  transition: "crossfade",
  transitionSeconds: 0.5,
};

const DEFAULT_SECONDS: Record<BoardNodeKind, number> = { recording: 4, text: 3, media: 3 };

type Position = BoardNode["position"];
type IdFactory = () => string;
const randomId: IdFactory = () => crypto.randomUUID();

export function createBoardNode(
  kind: BoardNodeKind,
  {
    title,
    position = { x: 0, y: 0 },
    id = randomId(),
    route = "/",
  }: { title: string; position?: Position; id?: string; route?: string }
): BoardNode {
  const base = { id, title, notes: "", duration: DEFAULT_SECONDS[kind], position };
  if (kind === "recording") return { ...base, kind, route, startFrom: "fresh" };
  if (kind === "text") return { ...base, kind, words: "" };
  return { ...base, kind };
}

export function findBoardNode(board: Board, nodeId: string): BoardNode | null {
  return board.nodes.find((node) => node.id === nodeId) ?? null;
}

export function updateBoardNode(board: Board, nodeId: string, update: (node: BoardNode) => BoardNode): Board {
  return { ...board, nodes: board.nodes.map((node) => (node.id === nodeId ? update(node) : node)) };
}

export function updateBoardEdge(board: Board, edgeId: string, update: (edge: BoardEdge) => BoardEdge): Board {
  return { ...board, edges: board.edges.map((edge) => (edge.id === edgeId ? update(edge) : edge)) };
}

export function moveBoardNodes(board: Board, positions: Record<string, Position>): Board {
  return {
    ...board,
    nodes: board.nodes.map((node) => (positions[node.id] ? { ...node, position: positions[node.id] } : node)),
  };
}

function outgoing(board: Board, nodeId: string): BoardEdge | undefined {
  return board.edges.find((edge) => edge.from === nodeId);
}

function byPosition(a: BoardNode, b: BoardNode): number {
  return a.position.y - b.position.y || a.position.x - b.position.x;
}

function reaches(board: Board, from: string, target: string): boolean {
  const seen = new Set<string>();
  let current: string | undefined = from;
  while (current && !seen.has(current)) {
    if (current === target) return true;
    seen.add(current);
    current = outgoing(board, current)?.to;
  }
  return false;
}

/**
 * Joins `from` to `to`. The video is one sequence, so a node keeps at most one edge in and one out: the
 * edges this replaces are dropped, and a join that would close a loop is refused.
 */
export function connectBoardNodes(board: Board, from: string, to: string, id: string = randomId()): Board {
  if (from === to || !findBoardNode(board, from) || !findBoardNode(board, to)) return board;
  const replaced = outgoing(board, from);
  if (replaced?.to === to) return board;
  const edges = board.edges.filter((edge) => edge.from !== from && edge.to !== to);
  if (reaches({ ...board, edges }, to, from)) return board;
  const transition = replaced
    ? { transition: replaced.transition, transitionSeconds: replaced.transitionSeconds }
    : DEFAULT_BOARD_TRANSITION;
  return { ...board, edges: [...edges, { id, from, to, ...transition }] };
}

/** Moves every node below `y` down by `delta`, to open a row for an inserted node. */
function openRows(board: Board, y: number, delta: number): Board {
  return {
    ...board,
    nodes: board.nodes.map((node) =>
      node.position.y > y ? { ...node, position: { ...node.position, y: node.position.y + delta } } : node
    ),
  };
}

/** Where a node added after `afterId` goes: the row below it, or below the lowest node. */
export function positionBelow(board: Board, afterId: string | null): Position {
  const after = afterId ? findBoardNode(board, afterId) : null;
  if (after) return { x: after.position.x, y: after.position.y + ROW };
  const lowest = [...board.nodes].sort(byPosition).at(-1);
  return lowest ? { x: lowest.position.x, y: lowest.position.y + ROW } : { x: 0, y: 0 };
}

/** The last node of the sequence, which a new node joins when nothing is selected. */
export function boardTail(board: Board): BoardNode | null {
  const order = boardOrder(board);
  return order.length > 0 ? order[order.length - 1] : null;
}

export type BoardSegment = { nodes: BoardNode[]; edges: BoardEdge[] };
type InsertOptions = {
  idFor?: IdFactory;
  /** Where the first node goes, e.g. where a connection was dropped; nothing below it moves. */
  at?: Position;
};

/**
 * Inserts `segment` after `afterId` (or after the tail when null), as a chain in the order given: kept
 * edges keep their transitions, and the node that followed `afterId` now follows the segment.
 */
export function insertBoardSegment(
  board: Board,
  segment: BoardSegment,
  afterId: string | null,
  { idFor = randomId, at }: InsertOptions = {}
): Board {
  if (segment.nodes.length === 0) return board;
  const after = afterId ? findBoardNode(board, afterId) : boardTail(board);
  const followerEdge = after ? outgoing(board, after.id) : undefined;
  const origin = at ?? positionBelow(board, after?.id ?? null);
  const placed = segment.nodes.map((node, index) => ({
    ...node,
    position: { x: origin.x, y: origin.y + index * ROW },
  }));
  const opened = after && !at ? openRows(board, after.position.y, placed.length * ROW) : board;
  const chain: BoardEdge[] = placed.slice(1).map((node, index) => {
    const previous = placed[index];
    const kept = segment.edges.find((edge) => edge.from === previous.id && edge.to === node.id);
    return kept ?? { id: idFor(), from: previous.id, to: node.id, ...DEFAULT_BOARD_TRANSITION };
  });
  const head = placed[0];
  const tail = placed[placed.length - 1];
  const edges = opened.edges.filter((edge) => edge !== followerEdge);
  if (after) {
    edges.push(
      followerEdge
        ? { ...followerEdge, to: head.id }
        : { id: idFor(), from: after.id, to: head.id, ...DEFAULT_BOARD_TRANSITION }
    );
  }
  if (followerEdge)
    edges.push({ id: idFor(), from: tail.id, to: followerEdge.to, ...DEFAULT_BOARD_TRANSITION });
  return { ...opened, nodes: [...opened.nodes, ...placed], edges: [...edges, ...chain] };
}

export function insertBoardNode(
  board: Board,
  node: BoardNode,
  afterId: string | null,
  options?: InsertOptions
): Board {
  return insertBoardSegment(board, { nodes: [node], edges: [] }, afterId, options);
}

/** Removes nodes and their edges, joining the nodes either side of a removed run so the sequence holds. */
export function removeBoardNodes(
  board: Board,
  nodeIds: readonly string[],
  edgeIds: readonly string[] = []
): Board {
  const removed = new Set(nodeIds);
  if (removed.size === 0 && edgeIds.length === 0) return board;
  const next = new Map(board.edges.map((edge) => [edge.from, edge.to]));
  const edges: BoardEdge[] = [];
  for (const edge of board.edges) {
    if (removed.has(edge.from) || edgeIds.includes(edge.id)) continue;
    let to: string | undefined = edge.to;
    const seen = new Set<string>();
    while (to && removed.has(to) && !seen.has(to)) {
      seen.add(to);
      to = next.get(to);
    }
    if (to && !removed.has(to) && to !== edge.from) edges.push({ ...edge, to });
  }
  return { ...board, nodes: board.nodes.filter((node) => !removed.has(node.id)), edges };
}

/** Copies of `nodeIds` in board order with fresh ids, and the edges between them. */
export function copyBoardSegment(
  board: Board,
  nodeIds: readonly string[],
  idFor: IdFactory = randomId
): BoardSegment {
  const picked = new Set(nodeIds);
  const nodes = boardOrder(board).filter((node) => picked.has(node.id));
  const ids = new Map(nodes.map((node) => [node.id, idFor()]));
  return {
    nodes: nodes.map((node) => ({ ...node, id: ids.get(node.id) ?? idFor() })),
    edges: board.edges
      .filter((edge) => picked.has(edge.from) && picked.has(edge.to))
      .map((edge) => ({ ...edge, id: idFor(), from: ids.get(edge.from) ?? "", to: ids.get(edge.to) ?? "" })),
  };
}

/** Duplicates the nodes as a run right after the last of them in the sequence. */
export function duplicateBoardNodes(
  board: Board,
  nodeIds: readonly string[],
  idFor: IdFactory = randomId
): { board: Board; nodeIds: string[] } {
  const segment = copyBoardSegment(board, nodeIds, idFor);
  const picked = new Set(nodeIds);
  const last = boardOrder(board)
    .filter((node) => picked.has(node.id))
    .at(-1);
  if (!last) return { board, nodeIds: [] };
  return {
    board: insertBoardSegment(board, segment, last.id, { idFor }),
    nodeIds: segment.nodes.map((node) => node.id),
  };
}

/** Swaps a node with its neighbour in the sequence, positions included. */
export function reorderBoardNode(board: Board, nodeId: string, direction: -1 | 1): Board {
  const order = boardOrder(board);
  const index = order.findIndex((node) => node.id === nodeId);
  const other = order[index + direction];
  if (index < 0 || !other) return board;
  const [first, second] = direction === 1 ? [order[index], other] : [other, order[index]];
  const swap = (id: string) => (id === first.id ? second.id : id === second.id ? first.id : id);
  const edges = board.edges
    .filter((edge) => !(edge.from === first.id && edge.to === second.id))
    .map((edge) => ({ ...edge, from: swap(edge.from), to: swap(edge.to) }));
  const between = board.edges.find((edge) => edge.from === first.id && edge.to === second.id);
  const reordered = {
    ...board,
    edges: between ? [...edges, { ...between, from: second.id, to: first.id }] : edges,
  };
  return moveBoardNodes(reordered, { [first.id]: second.position, [second.id]: first.position });
}

/** Re-flows positions into one column, top to bottom in board order. */
export function layoutBoard(board: Board): Board {
  const order = boardOrder(board);
  const rows = new Map(order.map((node, index) => [node.id, index]));
  return {
    ...board,
    nodes: board.nodes.map((node) => ({ ...node, position: { x: 0, y: (rows.get(node.id) ?? 0) * ROW } })),
  };
}

export type BoardIssue =
  | { code: "empty" }
  | { code: "invalid"; message: string }
  /** A recording's route isn't a path in the app; any path is fine, the catalogue only adds hints. */
  | { code: "unknown-route"; nodeId: string }
  | { code: "missing-file"; nodeId: string };

/** Why the board can't generate yet; empty when it can. */
export function boardIssues(board: Board): BoardIssue[] {
  if (board.nodes.length === 0) return [{ code: "empty" }];
  const issues: BoardIssue[] = [];
  const parsed = boardSchema.safeParse(board);
  if (!parsed.success) issues.push({ code: "invalid", message: parsed.error.issues[0]?.message ?? "" });
  for (const node of board.nodes) {
    if (node.kind === "recording" && !isAppPath(node.route))
      issues.push({ code: "unknown-route", nodeId: node.id });
    if (node.kind === "media" && !node.file) issues.push({ code: "missing-file", nodeId: node.id });
  }
  return issues;
}
