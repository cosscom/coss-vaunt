import { boardSchema } from "@coss/vaunt-engine/storyboard/board-schema";
import { describe, expect, it } from "vitest";
import { exampleBoard } from "./example-board";

describe("exampleBoard", () => {
  it("is a valid board of three numbered scenes, one per part of the example prompt", () => {
    const board = exampleBoard();
    expect(boardSchema.safeParse(board).success).toBe(true);
    expect(board.nodes.map((node) => node.title)).toEqual([
      "1 · Introducing vaunt",
      "2 · Open Links",
      "3 · End card",
    ]);
    expect(board.edges.map((edge) => [edge.from, edge.to])).toEqual([
      ["intro", "links"],
      ["links", "end"],
    ]);
  });
});
