import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { routeEntryFor } from "../catalogues/routes/route-catalogue";
import {
  agentConversation,
  conversationKey,
  paceReply,
  readAgentReplies,
  writeAgentReplies,
} from "./agent-replies";

const home = routeEntryFor("/home");
const composer = home?.targets.find((target) => target.name === "composer")?.selector ?? "";

describe("agentConversation", () => {
  it("collects the messages typed into the composer, earlier clips first", () => {
    const conversation = agentConversation([
      {
        route: "/home",
        entry: home,
        actions: [{ kind: "type", at: 0.5, target: composer, text: "What can I do?" }],
      },
      {
        route: "/home",
        entry: home,
        actions: [
          { kind: "click", at: 0.2, target: composer },
          { kind: "type", at: 1, target: composer, text: "Book Sandy" },
        ],
      },
    ]);
    expect(conversation).toEqual({ route: "/home", messages: ["What can I do?", "Book Sandy"] });
  });

  it("is null when nothing is sent to the agent", () => {
    expect(
      agentConversation([
        { route: "/bookings/upcoming", entry: routeEntryFor("/bookings/upcoming"), actions: [] },
      ])
    ).toBeNull();
  });

  it("keys conversations by page and words, not punctuation", () => {
    expect(conversationKey({ route: "/home", messages: ["What can I do?"] })).toBe(
      conversationKey({ route: "/home", messages: ["what can i do"] })
    );
    expect(conversationKey({ route: "/home", messages: ["a"] })).not.toBe(
      conversationKey({ route: "/home", messages: ["b"] })
    );
  });
});

describe("paceReply", () => {
  it("caps the wait before the reply and long pauses inside it, keeping the order", () => {
    const chunk = (type: string) => ({ type });
    const paced = paceReply([
      { atMs: 3000, chunk: chunk("start") },
      { atMs: 3100, chunk: chunk("text-delta") },
      { atMs: 6100, chunk: chunk("text-delta") },
      { atMs: 6150, chunk: chunk("finish") },
    ]);
    expect(paced.map((entry) => entry.atMs)).toEqual([900, 1000, 1450, 1500]);
    expect(paced.map((entry) => entry.chunk.type)).toEqual(["start", "text-delta", "text-delta", "finish"]);
  });
});

describe("readAgentReplies", () => {
  it("replays a complete capture and ignores one with a turn missing or empty", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "agent-replies-"));
    try {
      const conversation = { route: "/home", messages: ["one", "two"] };
      const turn = [{ atMs: 0, chunk: { type: "start" } }];
      const replies = {
        ...conversation,
        title: null,
        turns: [turn, turn],
        capturedAt: "2026-11-18T00:00:00Z",
      };
      await writeAgentReplies(dir, replies);
      expect(await readAgentReplies(dir, conversation)).toEqual(replies);
      await writeAgentReplies(dir, { ...replies, turns: [turn, []] });
      expect(await readAgentReplies(dir, conversation)).toBeNull();
      await writeAgentReplies(dir, { ...replies, turns: [turn] });
      expect(await readAgentReplies(dir, conversation)).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
