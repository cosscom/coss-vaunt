import { createBoardNode } from "@calcom/product-video/storyboard/board-edits";
import type { Board } from "@calcom/product-video/storyboard/board-schema";
import { describe, expect, it } from "vitest";
import {
  applySelectChanges,
  EMPTY_BOARD_SELECTION,
  growthOffsets,
  toFlowEdges,
  toFlowNodes,
  widthFitViewport,
} from "./board-flow";

const board: Board = {
  brief: "",
  nodes: [
    createBoardNode("recording", { id: "a", title: "Ask", route: "/nowhere" }),
    createBoardNode("text", { id: "b", title: "Title", position: { x: 0, y: 132 } }),
  ],
  edges: [{ id: "e", from: "a", to: "b", transition: "slide", transitionSeconds: 0.5 }],
};

describe("toFlowNodes", () => {
  it("maps scenes with their selection, status, issue and measured size", () => {
    const nodes = toFlowNodes(board, {
      selection: { nodeIds: ["b"], edgeIds: [] },
      generation: { a: { status: "recording" } },
      issues: [{ code: "unknown-route", nodeId: "a" }, { code: "empty" }],
      measured: { b: { width: 240, height: 76 } },
    });
    expect(
      nodes.map((node) => [node.id, node.selected, node.data.generation?.status ?? null, node.data.issue])
    ).toEqual([
      ["a", false, "recording", "unknown-route"],
      ["b", true, null, null],
    ]);
    expect(nodes[1]).toMatchObject({ position: { x: 0, y: 132 }, measured: { width: 240, height: 76 } });
  });
});

describe("toFlowEdges", () => {
  it("joins source to target and carries the board edge", () => {
    expect(toFlowEdges(board, { nodeIds: [], edgeIds: ["e"] })).toEqual([
      {
        id: "e",
        type: "transition",
        source: "a",
        target: "b",
        selected: true,
        data: { edge: board.edges[0] },
      },
    ]);
  });
});

describe("applySelectChanges", () => {
  it("adds and removes ids, and ignores batches without select changes", () => {
    expect(
      applySelectChanges(
        ["a"],
        [
          { type: "select", id: "a", selected: false },
          { type: "select", id: "b", selected: true },
        ]
      )
    ).toEqual(["b"]);
    expect(applySelectChanges(EMPTY_BOARD_SELECTION.nodeIds, [{ type: "position", id: "a" }])).toBeNull();
  });
});

describe("widthFitViewport", () => {
  const size = { width: 200, height: 60 };
  const options = { maxZoom: 0.9, minZoom: 0.5, inset: 16, top: 48 };

  it("caps the zoom and centres a single column, anchored at the top", () => {
    const nodes = [0, 1, 2, 3, 4, 5].map((index) => ({ position: { x: 0, y: index * 100 } }));
    expect(widthFitViewport(nodes, size, 300, options)).toEqual({ x: 60, y: 48, zoom: 0.9 });
  });

  it("zooms out for a wide board, but not past the minimum", () => {
    const wide = [{ position: { x: -100, y: 20 } }, { position: { x: 300, y: 20 } }];
    const viewport = widthFitViewport(wide, size, 300, options);
    expect(viewport.zoom).toBe(0.5);
    expect(viewport.y).toBe(48 - 20 * 0.5);
    expect(widthFitViewport([], size, 300, options)).toEqual({ x: 16, y: 48, zoom: 0.9 });
  });
});

describe("growthOffsets", () => {
  const scene = (id: string, x: number, y: number) => ({
    id,
    kind: "text" as const,
    title: id,
    notes: "",
    duration: 2,
    words: "",
    position: { x, y },
  });
  const board = {
    brief: "",
    edges: [],
    nodes: [scene("a", 0, 0), scene("b", 0, 100), scene("c", 0, 200), scene("side", 400, 300)],
  };

  it("pushes every card below a grown one down by how much it grew, but not cards beside it", () => {
    expect(growthOffsets(board, { a: { width: 208, height: 124 }, b: { width: 208, height: 84 } })).toEqual({
      a: 0,
      b: 60,
      c: 80,
      side: 0,
    });
  });

  it("leaves the board alone when no card has grown", () => {
    expect(growthOffsets(board, { a: { width: 208, height: 64 } })).toEqual({ a: 0, b: 0, c: 0, side: 0 });
  });
});
