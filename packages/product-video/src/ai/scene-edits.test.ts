import { describe, expect, it } from "vitest";
import { boardOrder } from "../storyboard/board-order";
import type { Board, BoardNode } from "../storyboard/board-schema";
import {
  addScene,
  chainInOrder,
  moveScene,
  patchScene,
  removeScene,
  setSceneDuration,
  setTransition,
  storyLines,
} from "./scene-edits";

const at = (y: number) => ({ x: 0, y });

const HOOK: BoardNode = {
  id: "hook",
  kind: "text",
  title: "Hook",
  notes: "",
  duration: 2,
  words: "Hi",
  position: at(0),
};
const ASK: BoardNode = {
  id: "ask",
  kind: "recording",
  title: "Ask",
  notes: "Type and send",
  duration: 6,
  route: "/home",
  startFrom: "fresh",
  position: at(112),
};
const REPLY: BoardNode = { ...ASK, id: "reply", title: "Reply", startFrom: "previous", position: at(224) };
const END: BoardNode = {
  id: "end",
  kind: "text",
  title: "End",
  notes: "",
  duration: 2,
  words: "Bye",
  position: at(336),
};

const BOARD: Board = {
  brief: "b",
  nodes: [HOOK, ASK, REPLY, END],
  edges: [
    { id: "e1", from: "hook", to: "ask", transition: "crossfade", transitionSeconds: 0.5 },
    { id: "e2", from: "ask", to: "reply", transition: "cut", transitionSeconds: 0 },
    { id: "e3", from: "reply", to: "end", transition: "slide", transitionSeconds: 0.4 },
  ],
};

let counter = 0;
const newId = () => `n${++counter}`;
const ids = (board: Board) => boardOrder(board).map((node) => node.id);
const edit = (result: ReturnType<typeof addScene>) => {
  if ("error" in result) throw new Error(result.error);
  return result.board;
};

describe("patchScene", () => {
  it("changes only the fields given", () => {
    const result = patchScene(BOARD, "hook", { words: "Still by email?", effect: "typewriter" });
    expect(result).toEqual({
      node: { ...HOOK, words: "Still by email?", effect: "typewriter" },
      summary: "Edited “Hook”: words, effect",
    });
  });

  it("clears an effect with null so generation picks one", () => {
    const withEffect = { ...BOARD, nodes: [{ ...HOOK, effect: "typewriter" }, ASK, REPLY, END] };
    const result = patchScene(withEffect, "hook", { effect: null });
    expect("node" in result && result.node).not.toHaveProperty("effect");
  });

  it("holds the patch to the draft rules", () => {
    const error = (patch: Parameters<typeof patchScene>[2], id = "ask") => {
      const result = patchScene(BOARD, id, patch);
      return "error" in result ? result.error : null;
    };
    expect(error({ route: "//evil.example" })).toContain("isn't a path in the app");
    expect(error({ effect: "nope" }, "hook")).toContain("isn't a text effect");
    expect(error({ duration: 9 })).toContain("at most 8 s");
    expect(error({ words: "Hi" })).toBe(
      "“Ask” is a recording scene, which has no words. It takes title, notes, duration, route, startFrom."
    );
    expect(error({ startFrom: "previous" })).toContain("has no recording before it");
    expect(error({ title: "" })).toContain("title");
    expect(error({})).toBe("The patch changes nothing.");
  });
});

describe("setSceneDuration", () => {
  it("sets one scene's length", () => {
    expect(setSceneDuration(BOARD, "end", 3)).toEqual({
      node: { ...END, duration: 3 },
      summary: "Set “End” to 3 s",
    });
  });
});

describe("chainInOrder", () => {
  it("keeps the edges of scenes that stay together and lays the board out", () => {
    const board = chainInOrder(BOARD, [HOOK, ASK, REPLY, END], newId);
    expect(board.edges).toEqual(BOARD.edges);
    expect(board.nodes.map((node) => node.position.y)).toEqual([0, 112, 224, 336]);
  });
});

describe("addScene", () => {
  it("inserts at a story position, joining its neighbours", () => {
    const board = edit(
      addScene(BOARD, { kind: "text", title: "Middle", notes: "", duration: 2, words: "And" }, 2, () => "mid")
    );
    expect(ids(board)).toEqual(["hook", "mid", "ask", "reply", "end"]);
    // The hook's edge (and its crossfade) now leads to the new scene; the new one joins the next by default.
    expect(board.edges.find((edge) => edge.from === "hook")).toMatchObject({
      id: "e1",
      to: "mid",
      transition: "crossfade",
    });
    expect(board.edges.find((edge) => edge.from === "mid")).toMatchObject({ to: "ask" });
    expect(board.edges).toHaveLength(4);
  });

  it("adds at the end when no position is given, and to an empty board", () => {
    const scene = { kind: "text" as const, title: "Outro", notes: "", duration: 2, words: "Fin" };
    expect(ids(edit(addScene(BOARD, scene, undefined, () => "outro"))).at(-1)).toBe("outro");
    const alone = edit(addScene({ brief: "", nodes: [], edges: [] }, scene, 1, () => "outro"));
    expect(alone.nodes).toHaveLength(1);
    expect(alone.edges).toEqual([]);
  });

  it("rejects a scene that breaks the rules", () => {
    expect(
      addScene(
        BOARD,
        { kind: "recording", title: "Bad", notes: "", duration: 4, route: "//x.dev", startFrom: "fresh" },
        2,
        newId
      )
    ).toMatchObject({ error: expect.stringContaining("isn't a path in the app") });
  });
});

describe("removeScene", () => {
  it("joins the scenes either side with the removed scene's incoming transition", () => {
    const board = edit(removeScene(BOARD, "reply", newId));
    expect(ids(board)).toEqual(["hook", "ask", "end"]);
    expect(board.edges).toEqual([BOARD.edges[0], { ...BOARD.edges[1], to: "end" }]);
  });

  it("starts the next recording fresh when the first one goes", () => {
    const board = edit(removeScene(BOARD, "ask", newId));
    expect(board.nodes.find((node) => node.id === "reply")).toMatchObject({ startFrom: "fresh" });
  });
});

describe("moveScene", () => {
  it("moves a scene and rejoins the chain, keeping ids", () => {
    const board = edit(moveScene(BOARD, "end", 1, newId));
    expect(ids(board)).toEqual(["end", "hook", "ask", "reply"]);
    expect(board.edges).toHaveLength(3);
    expect(board.nodes.map((node) => node.id).sort()).toEqual(["ask", "end", "hook", "reply"]);
  });

  it("says when the scene is already there", () => {
    expect(moveScene(BOARD, "hook", 1, newId)).toEqual({ error: "“Hook” is already scene 1." });
  });
});

describe("setTransition", () => {
  it("changes the edge between consecutive scenes, keeping its id", () => {
    const board = edit(setTransition(BOARD, "hook", "ask", { kind: "zoom-through", seconds: 1 }, newId));
    expect(board.edges[0]).toEqual({
      id: "e1",
      from: "hook",
      to: "ask",
      transition: "zoom-through",
      transitionSeconds: 1,
    });
  });

  it("makes a cut 0 s and keeps the seconds when none are given", () => {
    expect(
      edit(setTransition(BOARD, "reply", "end", { kind: "cut", seconds: 1 }, newId)).edges[2]
    ).toMatchObject({
      transitionSeconds: 0,
    });
    expect(edit(setTransition(BOARD, "reply", "end", { kind: "crossfade" }, newId)).edges[2]).toMatchObject({
      transition: "crossfade",
      transitionSeconds: 0.4,
    });
  });

  it("refuses scenes that aren't next to each other", () => {
    expect(setTransition(BOARD, "hook", "end", { kind: "cut" }, newId)).toEqual({
      error: "“End” doesn't follow “Hook”; a transition joins consecutive scenes, and “Ask” comes next.",
    });
  });
});

describe("storyLines", () => {
  it("lists scenes in story order with their ids", () => {
    expect(storyLines(BOARD)[0]).toBe("1. Hook (text, 2 s), id hook");
  });
});
