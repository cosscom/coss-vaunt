import { describe, expect, it } from "vitest";
import {
  BOARD_NODE_SIZE,
  BOARD_ROW_GAP,
  boardIssues,
  connectBoardNodes,
  copyBoardSegment,
  createBoardNode,
  duplicateBoardNodes,
  insertBoardNode,
  insertBoardSegment,
  layoutBoard,
  removeBoardNodes,
  reorderBoardNode,
} from "./board-edits";
import { boardOrder } from "./board-order";
import { type Board, type BoardEdge, boardSchema, EMPTY_BOARD } from "./board-schema";

const ROW = BOARD_NODE_SIZE.height + BOARD_ROW_GAP;

function ids(prefix: string) {
  let count = 0;
  return () => `${prefix}${++count}`;
}

function edge(from: string, to: string, extra: Partial<BoardEdge> = {}): BoardEdge {
  return { id: `${from}-${to}`, from, to, transition: "crossfade", transitionSeconds: 0.5, ...extra };
}

/** a → b → c, stacked. */
function chain(): Board {
  return {
    brief: "",
    nodes: ["a", "b", "c"].map((id, index) =>
      createBoardNode("text", { id, title: id.toUpperCase(), position: { x: 0, y: index * ROW } })
    ),
    edges: [edge("a", "b"), edge("b", "c", { transition: "slide" })],
  };
}

const order = (board: Board) => boardOrder(board).map((node) => node.id);

describe("createBoardNode", () => {
  it("makes a valid node of each kind", () => {
    const board: Board = {
      ...EMPTY_BOARD,
      nodes: (["recording", "text", "media"] as const).map((kind) =>
        createBoardNode(kind, { id: kind, title: kind })
      ),
    };
    expect(boardSchema.safeParse(board).success).toBe(true);
    expect(board.nodes[0]).toMatchObject({ kind: "recording", route: "/home", startFrom: "fresh" });
  });
});

describe("connectBoardNodes", () => {
  it("replaces the edges in and out so each node keeps one of each", () => {
    const board = connectBoardNodes(chain(), "a", "c", "new");
    expect(board.edges.map((e) => [e.from, e.to])).toEqual([["a", "c"]]);
    expect(board.edges[0]).toMatchObject({ id: "new", transition: "crossfade" });
  });

  it("refuses a loop, a self-edge and an existing edge", () => {
    const board = chain();
    expect(connectBoardNodes(board, "c", "a")).toBe(board);
    expect(connectBoardNodes(board, "a", "a")).toBe(board);
    expect(connectBoardNodes(board, "a", "b")).toBe(board);
  });

  it("keeps the transition of the edge it replaces", () => {
    const board = chain();
    const extra = createBoardNode("text", { id: "d", title: "D" });
    const next = connectBoardNodes({ ...board, nodes: [...board.nodes, extra] }, "b", "d");
    expect(next.edges.find((e) => e.from === "b")).toMatchObject({ to: "d", transition: "slide" });
  });
});

describe("insertBoardNode", () => {
  it("splices into the sequence and opens a row below", () => {
    const node = createBoardNode("recording", { id: "n", title: "N" });
    const board = insertBoardNode(chain(), node, "a", { idFor: ids("e") });
    expect(order(board)).toEqual(["a", "n", "b", "c"]);
    expect(board.nodes.find((n) => n.id === "n")?.position).toEqual({ x: 0, y: ROW });
    expect(board.nodes.find((n) => n.id === "b")?.position.y).toBe(2 * ROW);
    expect(boardSchema.safeParse(board).success).toBe(true);
  });

  it("places a dropped node where it was dropped without moving the rest", () => {
    const node = createBoardNode("text", { id: "n", title: "N" });
    const board = insertBoardNode(chain(), node, "a", { at: { x: 300, y: 40 } });
    expect(order(board)).toEqual(["a", "n", "b", "c"]);
    expect(board.nodes.find((n) => n.id === "n")?.position).toEqual({ x: 300, y: 40 });
    expect(board.nodes.find((n) => n.id === "b")?.position.y).toBe(ROW);
  });

  it("joins the tail when nothing is selected, and starts an empty board at the origin", () => {
    expect(order(insertBoardNode(chain(), createBoardNode("text", { id: "n", title: "N" }), null))).toEqual([
      "a",
      "b",
      "c",
      "n",
    ]);
    const first = insertBoardNode(EMPTY_BOARD, createBoardNode("text", { id: "n", title: "N" }), null);
    expect(first.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(first.edges).toEqual([]);
  });
});

describe("removeBoardNodes", () => {
  it("bridges the gap with the edge that led in", () => {
    const board = removeBoardNodes(chain(), ["b"]);
    expect(board.edges).toEqual([{ ...edge("a", "b"), to: "c" }]);
  });

  it("bridges a removed run and drops edges by id", () => {
    expect(removeBoardNodes(chain(), ["b", "c"]).edges).toEqual([]);
    expect(removeBoardNodes(chain(), [], ["a-b"]).edges.map((e) => e.id)).toEqual(["b-c"]);
  });
});

describe("duplicate, copy and paste", () => {
  it("duplicates a run right after itself, keeping its inner transition", () => {
    const result = duplicateBoardNodes(chain(), ["b", "c"], ids("x"));
    expect(result.nodeIds).toEqual(["x1", "x2"]);
    expect(order(result.board)).toEqual(["a", "b", "c", "x1", "x2"]);
    expect(result.board.edges.find((e) => e.from === "x1")).toMatchObject({ to: "x2", transition: "slide" });
    expect(boardSchema.safeParse(result.board).success).toBe(true);
  });

  it("pastes copied nodes as a chain after the given node", () => {
    const segment = copyBoardSegment(chain(), ["c", "a"], ids("p"));
    expect(segment.nodes.map((node) => node.title)).toEqual(["A", "C"]);
    const board = insertBoardSegment(chain(), segment, "a", { idFor: ids("e") });
    expect(order(board)).toEqual(["a", "p1", "p2", "b", "c"]);
  });
});

describe("reorderBoardNode", () => {
  it("swaps a node with its neighbour and their positions", () => {
    const board = reorderBoardNode(chain(), "b", 1);
    expect(order(board)).toEqual(["a", "c", "b"]);
    expect(board.nodes.find((n) => n.id === "c")?.position.y).toBe(ROW);
    expect(boardSchema.safeParse(board).success).toBe(true);
    expect(reorderBoardNode(chain(), "a", -1)).toEqual(chain());
  });
});

describe("layoutBoard", () => {
  it("stacks nodes in one column in board order", () => {
    const board = chain();
    const scrambled = {
      ...board,
      nodes: board.nodes.map((node, index) => ({
        ...node,
        position: { x: index * 50, y: 900 - index * 400 },
      })),
    };
    expect(layoutBoard(scrambled).nodes.map((node) => node.position)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: ROW },
      { x: 0, y: 2 * ROW },
    ]);
  });
});

describe("boardIssues", () => {
  it("flags an empty board, a route that isn't an app path and a media node without a file", () => {
    expect(boardIssues(EMPTY_BOARD)).toEqual([{ code: "empty" }]);
    const board: Board = {
      ...EMPTY_BOARD,
      nodes: [
        createBoardNode("recording", { id: "r", title: "R", route: "//elsewhere.example" }),
        createBoardNode("media", { id: "m", title: "M" }),
      ],
    };
    expect(boardIssues(board)).toEqual([
      { code: "unknown-route", nodeId: "r" },
      { code: "missing-file", nodeId: "m" },
    ]);
    expect(boardIssues(chain())).toEqual([]);
  });
});
