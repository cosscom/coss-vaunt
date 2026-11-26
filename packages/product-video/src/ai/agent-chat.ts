import { streamText } from "ai";
import { z } from "zod";
import { loadStudioModel, type StudioModel } from "./studio-model";

/** A discussion, so a reply is a few paragraphs at most. */
const MAX_REPLY_TOKENS = 1200;

/** The body of a chat request: the conversation so far, ending with the author's message, and what they see. */
export const agentChatRequestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(20000) }))
    .min(1)
    .max(200)
    .refine((messages) => messages.at(-1)?.role === "user", "The last message must be the author's"),
  /** The project, the board, the timeline and whatever the author is pointing at, described in prose. */
  context: z.string().max(40000),
});

export type AgentChatRequest = z.infer<typeof agentChatRequestSchema>;

/** The agent's instructions, with the project the author is looking at. */
export function agentSystemPrompt(context: string): string {
  return [
    "You are the creative director inside coss vaunt, a studio for making product videos from screen recordings,",
    "text scenes and media. You're in a discussion with the author: you can't change the project yourself yet, so",
    "talk it through and give concrete suggestions (scene order, durations in seconds, hooks, copy, pacing,",
    "transitions) grounded in the project below. Be brief and direct: short paragraphs or tight lists, no preamble.",
    "When the author points at a clip or a moment, answer about that first.",
    "",
    "<project>",
    context.trim() || "Nothing is known about the project yet.",
    "</project>",
  ].join("\n");
}

/** Streams the agent's reply as text. Without `model`, it uses the one in the AI settings. */
export async function streamAgentReply(
  { messages, context }: AgentChatRequest,
  { model, abortSignal }: { model?: StudioModel; abortSignal?: AbortSignal } = {}
): Promise<ReadableStream<string>> {
  const result = streamText({
    model: model ?? (await loadStudioModel()),
    system: agentSystemPrompt(context),
    messages,
    maxOutputTokens: MAX_REPLY_TOKENS,
    abortSignal,
    providerOptions: { anthropic: { effort: "low" }, openai: { reasoningEffort: "low" } },
  });
  return result.textStream;
}
