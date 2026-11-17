import { describe, expect, it } from "vitest";
import { groupWordsIntoLines } from "./measured-lines";

describe("groupWordsIntoLines", () => {
  it("starts a new line whenever the top offset changes", () => {
    expect(
      groupWordsIntoLines([
        { text: "Schedule", top: 0 },
        { text: "meetings", top: 0.4 },
        { text: "without", top: 52 },
        { text: "the", top: 52 },
        { text: "fuss", top: 104 },
      ])
    ).toEqual(["Schedule meetings", "without the", "fuss"]);
  });

  it("returns no lines for no words", () => {
    expect(groupWordsIntoLines([])).toEqual([]);
  });
});
