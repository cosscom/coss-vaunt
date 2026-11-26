import { describe, expect, it } from "vitest";
import { agentChatRequestSchema, agentSystemPrompt } from "./agent-chat";

describe("agentChatRequestSchema", () => {
  it("takes a conversation that ends with the author's message", () => {
    const parsed = agentChatRequestSchema.safeParse({
      messages: [
        { role: "user", content: "Suggest a hook" },
        { role: "assistant", content: "Open on the result." },
        { role: "user", content: "Shorter?" },
      ],
      context: "Project “Launch”",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a conversation that ends with the agent, or is empty", () => {
    expect(
      agentChatRequestSchema.safeParse({ messages: [{ role: "assistant", content: "Hi" }], context: "" })
        .success
    ).toBe(false);
    expect(agentChatRequestSchema.safeParse({ messages: [], context: "" }).success).toBe(false);
  });

  it("rejects blank messages", () => {
    expect(
      agentChatRequestSchema.safeParse({ messages: [{ role: "user", content: "   " }], context: "" }).success
    ).toBe(false);
  });
});

describe("agentSystemPrompt", () => {
  it("puts the project inside the instructions", () => {
    expect(agentSystemPrompt("Project “Launch”, 16:9")).toContain(
      "<project>\nProject “Launch”, 16:9\n</project>"
    );
  });

  it("says when nothing is known about the project", () => {
    expect(agentSystemPrompt("  ")).toContain("Nothing is known about the project yet.");
  });
});
