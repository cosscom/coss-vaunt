import { z } from "zod";
import { boardSchema } from "../storyboard/board-schema";
import { VIDEO_THEMES } from "../storyboard/storyboard-schema";

/** The most turns a saved thread keeps; the oldest go first. */
export const MAX_THREAD_MESSAGES = 400;

const changeBase = { id: z.string().min(1), summary: z.string(), undone: z.boolean().optional() };

/** Something the agent changed, with what was there before so its card can undo it. */
export const agentChangeSchema = z.union([
  z.object({
    ...changeBase,
    /** `board` is a draft, `edit` a direct edit to the board, `scene` one scene. */
    kind: z.enum(["board", "edit", "scene"]),
    before: boardSchema,
    /** For a draft: the planner's reasons for its scenes. */
    rationale: z.string().optional(),
  }),
  z.object({ ...changeBase, kind: z.literal("theme"), before: z.enum(VIDEO_THEMES) }),
]);

/** One turn of the conversation, as the studio shows it and saves it beside the project. */
export const agentMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  /** What was in context when the author sent it, by label, to show under their message. */
  context: z.array(z.string()).optional(),
  /** A reply that didn't arrive; its text is the error, and it isn't sent back to the agent. */
  failed: z.boolean().optional(),
  /** A question for the author, answered by picking a reply or typing. */
  ask: z.object({ question: z.string(), options: z.array(z.string()) }).optional(),
  changes: z.array(agentChangeSchema).optional(),
});

/** A saved thread as the studio sends it: every turn, oldest first. */
export const agentThreadSchema = z.object({
  messages: z.array(agentMessageSchema).max(MAX_THREAD_MESSAGES * 2),
});

export type AgentChange = z.infer<typeof agentChangeSchema>;
export type AgentMessage = z.infer<typeof agentMessageSchema>;

/**
 * The turns of a stored thread that still read, in order, and at most the latest `MAX_THREAD_MESSAGES`: a turn
 * that no longer fits the schema is dropped rather than losing the whole conversation.
 */
export function parseAgentThread(value: unknown): AgentMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      const parsed = agentMessageSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    })
    .slice(-MAX_THREAD_MESSAGES);
}
