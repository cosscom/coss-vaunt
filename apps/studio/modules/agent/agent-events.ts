import type { AgentEvent } from "@coss/vaunt-engine/ai/agent-chat";
import type { AgentMessage } from "@coss/vaunt-engine/ai/agent-thread";
import type { Board } from "@coss/vaunt-engine/storyboard/board-schema";

export type { AgentChange, AgentMessage } from "@coss/vaunt-engine/ai/agent-thread";

/** The board after an event that changes it (a draft, an edit or one scene), or null for any other event. */
export function boardAfter(event: AgentEvent, board: Board): Board | null {
  if (event.type === "board" || event.type === "edit") return event.board;
  if (event.type === "scene")
    return { ...board, nodes: board.nodes.map((node) => (node.id === event.nodeId ? event.node : node)) };
  return null;
}

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
 * How an agent turn reads back to the agent: its words, plus what it asked and changed (with a draft's reasons), so
 * it remembers a question it's waiting on, can say why a scene is there, and knows when the author undid something.
 */
export function historyContent(message: AgentMessage): string {
  const notes = [
    ...(message.ask
      ? [`[Asked the author: ${message.ask.question} Replies: ${message.ask.options.join(" / ")}]`]
      : []),
    ...(message.changes ?? []).map((change) => {
      const why =
        change.kind === "board" && change.rationale ? `. Why these scenes: ${change.rationale}` : "";
      return `[${change.summary}${why}${change.undone ? "; the author undid this" : ""}]`;
    }),
  ];
  return [message.content.trim(), ...notes].filter(Boolean).join("\n\n");
}
