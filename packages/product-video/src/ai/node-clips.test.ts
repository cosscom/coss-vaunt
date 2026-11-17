import { describe, expect, it } from "vitest";
import type { BoardNode } from "../storyboard/board-schema";
import { defaultTextEffect, mediaClipForNode, textClipForNode, textEffectFor } from "./node-clips";

const text = (
  overrides: Partial<Extract<BoardNode, { kind: "text" }>> = {}
): Extract<BoardNode, { kind: "text" }> => ({
  id: "t",
  kind: "text",
  title: "Hook",
  notes: "",
  duration: 2.5,
  position: { x: 0, y: 0 },
  words: "Meet your agent",
  ...overrides,
});

const neverPick = async () => {
  throw new Error("The model shouldn't be asked");
};

describe("textEffectFor", () => {
  it("keeps the node's own effect", async () => {
    expect(await textEffectFor(text({ effect: "typewriter" }), neverPick)).toBe("typewriter");
  });

  it("asks the model only when the node has direction", async () => {
    expect(await textEffectFor(text({ notes: "Make it feel calm" }), async () => "soft-blur-in")).toBe(
      "soft-blur-in"
    );
    expect(await textEffectFor(text(), neverPick)).toBe(defaultTextEffect("Meet your agent"));
  });

  it("defaults by length", () => {
    expect(defaultTextEffect("Cal.com")).toBe("spring-scale-in");
    expect(defaultTextEffect("Book your next meeting in one line")).toBe("per-word-crossfade");
    expect(defaultTextEffect("one two three four five six seven eight nine")).toBe("line-by-line-slide");
  });
});

describe("textClipForNode", () => {
  it("makes a text clip that remembers its node", () => {
    const clip = textClipForNode(text(), "typewriter", "clip-1");
    expect(clip).toMatchObject({ id: "clip-1", duration: 2.5, storyboardNodeId: "t", name: "Hook" });
    expect(clip.source).toMatchObject({ kind: "text", text: "Meet your agent", effectIn: "typewriter" });
  });

  it("refuses empty words", () => {
    expect(() => textClipForNode(text({ words: " " }), "typewriter")).toThrow("Add the words to show");
  });
});

describe("mediaClipForNode", () => {
  it("asks for a file when there is none", async () => {
    await expect(
      mediaClipForNode(
        { id: "m", kind: "media", title: "Logo", notes: "", duration: 2, position: { x: 0, y: 0 } },
        "/tmp"
      )
    ).rejects.toThrow("Pick a file");
  });
});
