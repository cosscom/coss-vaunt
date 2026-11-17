import { z } from "zod";

const milliseconds = z.number().int().min(0).max(30_000);
const toolName = z.string().regex(/^[a-z][a-z0-9_]*$/);

export const scriptedReplyPartSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pause"), ms: milliseconds }),
  /** Streamed word by word over `ms`. */
  z.object({ kind: z.literal("reasoning"), text: z.string().min(1), ms: milliseconds }),
  z.object({ kind: z.literal("text"), text: z.string().min(1), ms: milliseconds }),
  /** A read tool: its input arrives, then its output `ms` later. */
  z.object({
    kind: z.literal("tool"),
    toolName,
    input: z.record(z.string(), z.unknown()),
    output: z.unknown(),
    ms: milliseconds,
  }),
  /** A write tool that stops the turn on an approval card built from `display`. */
  z.object({
    kind: z.literal("approval"),
    toolName,
    input: z.record(z.string(), z.unknown()),
    display: z.record(z.string(), z.unknown()),
  }),
]);

export const scriptedReplyFixtureSchema = z.object({
  /** The message this reply answers; any other message gets `GENERIC_REPLY`. Absent: it answers every message. */
  prompt: z.string().min(1).optional(),
  /** What `/api/ai/chat/session/title` answers once the turn has started. */
  title: z.string().min(1).max(80),
  /** One reply per user turn, in order; each reply is a list of model steps. */
  turns: z.array(z.object({ steps: z.array(z.array(scriptedReplyPartSchema).min(1)).min(1) })).min(1),
});

/** What the agent says to a message no fixture answers: a short greeting, with no tools or approval. */
export const GENERIC_REPLY: ScriptedReplyFixture = {
  title: "Chat with your agent",
  turns: [
    {
      steps: [
        [
          { kind: "pause", ms: 400 },
          {
            kind: "text",
            text: "Hi! I can find times, book meetings and manage your calendar. What would you like to do?",
            ms: 1200,
          },
        ],
      ],
    },
  ],
};

/** Case, spacing and punctuation don't matter when matching a typed message to a fixture's prompt. */
export function normalisePrompt(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export type ScriptedReplyPart = z.infer<typeof scriptedReplyPartSchema>;
export type ScriptedReplyFixture = z.infer<typeof scriptedReplyFixtureSchema>;

/** A UI message stream chunk, as the AI SDK's `useChat` reads it. */
export type UiMessageChunk = { type: string } & Record<string, unknown>;
export type TimedChunk = { atMs: number; chunk: UiMessageChunk };

/** Pause between consecutive structural chunks, so each lands on its own frame or two. */
const CHUNK_GAP_MS = 40;

function words(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? [text];
}

/** Every chunk of one turn's reply with its offset from the response start, ending in `finish`. */
export function scriptedTurnChunks(fixture: ScriptedReplyFixture, turnIndex: number): TimedChunk[] {
  const turn = fixture.turns[Math.min(turnIndex, fixture.turns.length - 1)];
  const chunks: TimedChunk[] = [];
  let atMs = 0;
  let partNumber = 0;
  const push = (chunk: UiMessageChunk, gapMs = CHUNK_GAP_MS) => {
    chunks.push({ atMs, chunk });
    atMs += gapMs;
  };
  const streamWords = (kind: "reasoning" | "text", text: string, ms: number) => {
    const id = `${kind}-${turnIndex}-${partNumber}`;
    const pieces = words(text);
    const gap = Math.round(ms / pieces.length);
    push({ type: `${kind}-start`, id }, 0);
    for (const delta of pieces) push({ type: `${kind}-delta`, id, delta }, gap);
    push({ type: `${kind}-end`, id });
  };

  push({ type: "start", messageId: `scripted-${turnIndex}` }, 0);
  for (const step of turn.steps) {
    push({ type: "start-step" }, 0);
    for (const part of step) {
      partNumber++;
      const toolCallId = `call-${turnIndex}-${partNumber}`;
      switch (part.kind) {
        case "pause":
          atMs += part.ms;
          break;
        case "reasoning":
        case "text":
          streamWords(part.kind, part.text, part.ms);
          break;
        case "tool":
          push({ type: "tool-input-start", toolCallId, toolName: part.toolName });
          push(
            { type: "tool-input-available", toolCallId, toolName: part.toolName, input: part.input },
            part.ms
          );
          push({ type: "tool-output-available", toolCallId, output: part.output });
          break;
        case "approval":
          push({ type: "tool-input-start", toolCallId, toolName: part.toolName });
          push({ type: "tool-input-available", toolCallId, toolName: part.toolName, input: part.input }, 0);
          push({ type: "data-approval-display", id: toolCallId, data: part.display }, 0);
          push({
            type: "tool-approval-request",
            approvalId: `approval-${turnIndex}-${partNumber}`,
            toolCallId,
          });
          break;
      }
    }
    push({ type: "finish-step" }, 0);
  }
  push({ type: "finish" }, 0);
  return chunks;
}
