import { createProject } from "@coss/vaunt-engine/storyboard/storyboard-factories";
import type { Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { describe, expect, it } from "vitest";
import { createHistory, pushHistory, redo, undo } from "./project-history";

const base = createProject({ name: "History", now: new Date("2026-11-17T10:00:00Z") });
const named = (name: string): Project => ({ ...base, name });

describe("project history", () => {
  it("undoes and redoes", () => {
    const history = pushHistory(pushHistory(createHistory(base), named("a"), { now: 0 }), named("b"), {
      now: 10,
    });
    expect(undo(history).present.name).toBe("a");
    expect(undo(undo(history)).present.name).toBe("History");
    expect(redo(undo(history)).present.name).toBe("b");
  });

  it("coalesces a continuous edit into one entry", () => {
    let history = createHistory(base);
    for (const [index, name] of ["z1", "z2", "z3"].entries()) {
      history = pushHistory(history, named(name), { group: "zoom", now: index * 100 });
    }
    expect(history.past).toHaveLength(1);
    expect(undo(history).present.name).toBe("History");
  });

  it("starts a new entry after a pause or a different group", () => {
    let history = pushHistory(createHistory(base), named("a"), { group: "zoom", now: 0 });
    history = pushHistory(history, named("b"), { group: "zoom", now: 5000 });
    history = pushHistory(history, named("c"), { group: "pan", now: 5100 });
    expect(history.past).toHaveLength(3);
  });

  it("drops the redo stack on a new edit", () => {
    const history = undo(pushHistory(createHistory(base), named("a"), { now: 0 }));
    expect(pushHistory(history, named("b"), { now: 1 }).future).toEqual([]);
  });
});
