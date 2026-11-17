import { describe, expect, it } from "vitest";
import {
  EMPTY_PROJECT_SELECTION,
  idsInBox,
  projectClickIntent,
  pruneProjectSelection,
  selectProject,
} from "./project-selection";

const order = ["a", "b", "c", "d"];

describe("selectProject", () => {
  it("toggles a project in and out", () => {
    const one = selectProject(EMPTY_PROJECT_SELECTION, order, "b", { range: false });
    expect(one.ids).toEqual(["b"]);
    expect(selectProject(one, order, "b", { range: false }).ids).toEqual([]);
  });

  it("selects the range from the last project clicked, in either direction", () => {
    const anchored = selectProject(EMPTY_PROJECT_SELECTION, order, "c", { range: false });
    expect(selectProject(anchored, order, "a", { range: true }).ids).toEqual(["c", "a", "b"]);
    expect(selectProject(anchored, order, "d", { range: true }).ids).toEqual(["c", "d"]);
  });

  it("toggles when there is no anchor to range from", () => {
    expect(selectProject(EMPTY_PROJECT_SELECTION, order, "b", { range: true }).ids).toEqual(["b"]);
  });
});

describe("pruneProjectSelection", () => {
  it("drops deleted projects", () => {
    expect(pruneProjectSelection({ ids: ["a", "x"], anchor: "x" }, order)).toEqual({
      ids: ["a"],
      anchor: null,
    });
  });
});

describe("projectClickIntent", () => {
  const click = { metaKey: false, ctrlKey: false, shiftKey: false };

  it("opens on a plain click, and toggles while selecting", () => {
    expect(projectClickIntent(click, false)).toBe("open");
    expect(projectClickIntent(click, true)).toBe("toggle");
  });

  it("toggles on ⌘ or Ctrl and selects a range on Shift", () => {
    expect(projectClickIntent({ ...click, metaKey: true }, false)).toBe("toggle");
    expect(projectClickIntent({ ...click, ctrlKey: true }, false)).toBe("toggle");
    expect(projectClickIntent({ ...click, shiftKey: true }, false)).toBe("range");
  });
});

describe("idsInBox", () => {
  const rect = (left: number, top: number) => ({ left, top, right: left + 10, bottom: top + 10 });

  it("returns the cards the box touches", () => {
    const cards = [
      { id: "a", rect: rect(0, 0) },
      { id: "b", rect: rect(20, 0) },
      { id: "c", rect: rect(0, 20) },
    ];
    expect(idsInBox({ left: 5, top: 5, right: 25, bottom: 8 }, cards)).toEqual(["a", "b"]);
  });
});
