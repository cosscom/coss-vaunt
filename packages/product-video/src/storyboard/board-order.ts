import type { Board, BoardEdge, BoardNode } from "./board-schema";

const byPosition = (a: BoardNode, b: BoardNode) => a.position.y - b.position.y || a.position.x - b.position.x;

/**
 * The story order: from the root (no incoming edge, topmost first) along outgoing edges, taking the topmost
 * target at a fork, then every node the walk didn't reach, top to bottom.
 */
export function boardOrder(board: Board): BoardNode[] {
  const nodes = new Map(board.nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, BoardNode[]>();
  const hasIncoming = new Set<string>();
  for (const edge of board.edges) {
    const target = nodes.get(edge.to);
    if (!target || !nodes.has(edge.from)) continue;
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), target]);
    hasIncoming.add(edge.to);
  }
  const ordered: BoardNode[] = [];
  const visited = new Set<string>();
  const roots = board.nodes
    .filter((node) => !hasIncoming.has(node.id) && outgoing.has(node.id))
    .sort(byPosition);
  let current: BoardNode | undefined = roots[0];
  while (current && !visited.has(current.id)) {
    ordered.push(current);
    visited.add(current.id);
    current = (outgoing.get(current.id) ?? []).filter((node) => !visited.has(node.id)).sort(byPosition)[0];
  }
  return [...ordered, ...board.nodes.filter((node) => !visited.has(node.id)).sort(byPosition)];
}

/** The edge into `nodeId` from the node before it in story order, or any edge into it. */
export function incomingEdge(board: Board, nodeId: string): BoardEdge | null {
  const order = boardOrder(board);
  const index = order.findIndex((node) => node.id === nodeId);
  const previous = index > 0 ? order[index - 1] : undefined;
  const into = board.edges.filter((edge) => edge.to === nodeId);
  return into.find((edge) => edge.from === previous?.id) ?? into[0] ?? null;
}
