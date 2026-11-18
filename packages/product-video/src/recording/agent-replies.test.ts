import { describe, expect, it } from "vitest";
import { routeEntryFor } from "../catalogues/routes/route-catalogue";
import { agentConversation, conversationKey, paceReply } from "./agent-replies";

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
