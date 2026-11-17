import { describe, expect, it } from "vitest";
import { boardOrder, incomingEdge } from "./board-order";
import type { Board, BoardEdge, BoardNode } from "./board-schema";

const textNode = (id: string, y: number, x = 0): BoardNode => ({
  id,
  kind: "text",
  title: id,
  notes: "",
  duration: 2,
  position: { x, y },
  words: id,
});

const edge = (from: string, to: string, transitionSeconds = 0.5): BoardEdge => ({
  id: `${from}-${to}`,
  from,
  to,
  transition: "crossfade",
  transitionSeconds,
});

const ids = (board: Board) => boardOrder(board).map((node) => node.id);

describe("boardOrder", () => {
  it("follows edges from the root, whatever the positions", () => {
    const board: Board = {
      brief: "",
      nodes: [textNode("c", 0), textNode("a", 200), textNode("b", 100)],
      edges: [edge("b", "c"), edge("a", "b")],
    };
    expect(ids(board)).toEqual(["a", "b", "c"]);
  });

  it("appends unconnected nodes top to bottom", () => {
    const board: Board = {
      brief: "",
      nodes: [textNode("loose-low", 500), textNode("a", 300), textNode("b", 400), textNode("loose-high", 0)],
      edges: [edge("a", "b")],
    };
    expect(ids(board)).toEqual(["a", "b", "loose-high", "loose-low"]);
  });

  it("orders a board without edges by y, then x", () => {
    const board: Board = {
      brief: "",
      nodes: [textNode("right", 0, 50), textNode("low", 10), textNode("left", 0, 0)],
      edges: [],
    };
    expect(ids(board)).toEqual(["left", "right", "low"]);
  });

  it("takes the topmost target at a fork", () => {
    const board: Board = {
      brief: "",
      nodes: [textNode("a", 0), textNode("low", 300), textNode("high", 100)],
      edges: [edge("a", "low"), edge("a", "high")],
    };
    expect(ids(board)).toEqual(["a", "high", "low"]);
  });

  it("falls back to positions when every node is in a cycle", () => {
    const board: Board = {
      brief: "",
      nodes: [textNode("b", 100), textNode("a", 0)],
      edges: [edge("a", "b"), edge("b", "a")],
    };
    expect(ids(board)).toEqual(["a", "b"]);
  });
});

describe("incomingEdge", () => {
  it("is the edge from the previous node in story order", () => {
    const board: Board = {
      brief: "",
      nodes: [textNode("a", 0), textNode("b", 100)],
      edges: [edge("a", "b", 1)],
    };
    expect(incomingEdge(board, "b")).toMatchObject({ from: "a", transitionSeconds: 1 });
    expect(incomingEdge(board, "a")).toBeNull();
  });
});
