import { describe, expect, it } from "vitest";
import bookSandyOneOnOne from "../catalogues/routes/fixtures/book-sandy-one-on-one.json";
import {
  GENERIC_REPLY,
  normalisePrompt,
  scriptedReplyFixtureSchema,
  scriptedTurnChunks,
} from "./scripted-reply";

describe("normalisePrompt", () => {
  it("ignores case, spacing and punctuation", () => {
    expect(normalisePrompt("  Book Sandy for a 1on1, at the END of this week! ")).toBe(
      normalisePrompt("book sandy for a 1on1 at the end of this week")
    );
    expect(normalisePrompt("Hello!")).not.toBe(normalisePrompt("Book Sandy"));
  });
});

describe("scripted replies", () => {
  it("names the message the Book Sandy fixture answers", () => {
    expect(scriptedReplyFixtureSchema.parse(bookSandyOneOnOne).prompt).toBe(
      "Book Sandy for a 1on1 at the end of this week"
    );
  });

  it("answers anything else with a short reply and no approval", () => {
    const chunks = scriptedTurnChunks(GENERIC_REPLY, 0).map((timed) => timed.chunk.type);
    expect(chunks).toContain("text-delta");
    expect(chunks).not.toContain("tool-approval-request");
  });
});
