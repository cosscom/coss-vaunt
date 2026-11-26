import type { AgentEvent } from "@coss/vaunt-engine/ai/agent-chat";
import type { Board } from "@coss/vaunt-engine/storyboard/board-schema";
import type { ProjectSettings } from "@coss/vaunt-engine/storyboard/storyboard-schema";

/** Something the agent changed, with what was there before so its card can undo it. */
export type AgentChange =
  | { id: string; kind: "board" | "scene"; summary: string; before: Board; undone?: boolean }
  | { id: string; kind: "theme"; summary: string; before: ProjectSettings["theme"]; undone?: boolean };

export type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** What was in context when the author sent it, by label, to show under their message. */
  context?: string[];
  /** A reply that didn't arrive; its text is the error, and it isn't sent back to the agent. */
  failed?: boolean;
  /** A question for the author, answered by picking a reply or typing. */
  ask?: { question: string; options: string[] };
  changes?: AgentChange[];
};

/** Splits newline-delimited JSON events off the front of `buffer`; the rest is an unfinished line. */
export function takeEvents(buffer: string): { events: AgentEvent[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events = lines.flatMap((line) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line) as AgentEvent];
    } catch {
      return [];
    }
  });
  return { events, rest };
}

/**
 * How an agent turn reads back to the agent: its words, plus what it asked and changed, so it remembers a question
 * it's waiting on and knows when the author undid something.
 */
export function historyContent(message: AgentMessage): string {
  const notes = [
    ...(message.ask
      ? [`[Asked the author: ${message.ask.question} Replies: ${message.ask.options.join(" / ")}]`]
      : []),
    ...(message.changes ?? []).map(
      (change) => `[${change.summary}${change.undone ? "; the author undid this" : ""}]`
    ),
  ];
  return [message.content.trim(), ...notes].filter(Boolean).join("\n\n");
}
