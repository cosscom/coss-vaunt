import { type Tool, tool } from "@calcom/ai/agent-tool";
import { generateText, stepCountIs } from "@calcom/ai/generate-text";
import type { z } from "zod";
import type { StudioModel } from "./studio-model";

export type SubmitTool<Schema extends z.ZodType> = {
  name: string;
  description: string;
  schema: Schema;
  /** Problems with a submission, sent back to the model so it can fix them; empty accepts it. Throwing ends the loop. */
  check: (value: z.infer<Schema>) => Promise<string[]> | string[];
  /** Rejected submissions allowed before the loop gives up. */
  maxAttempts?: number;
};

export type SubmitLoopUsage = { inputTokens: number; outputTokens: number; steps: number };

export class NoSubmissionError extends Error {
  constructor(
    message: string,
    /** What the model said instead of submitting, often why it couldn't. */
    readonly reply: string
  ) {
    super(message);
  }
}

/**
 * Runs the model with `tools` until it submits a value `submit.check` accepts, or runs out of steps. Opus 5.5
 * rejects forced tool choice, so the prompt asks for the submit tool and the loop stops once it's accepted.
 */
export async function runUntilSubmitted<Schema extends z.ZodType>({
  model,
  system,
  prompt,
  tools = {},
  submit,
  maxSteps,
  effort = "medium",
  onToolCall,
}: {
  model: StudioModel;
  system: string;
  prompt: string;
  tools?: Record<string, Tool>;
  submit: SubmitTool<Schema>;
  maxSteps: number;
  effort?: "low" | "medium" | "high";
  onToolCall?: (name: string, input: unknown) => void;
}): Promise<{ value: z.infer<Schema>; usage: SubmitLoopUsage }> {
  const state: {
    accepted: { value: z.infer<Schema> } | null;
    rejected: number;
    lastErrors: string[];
    thrown: { error: unknown } | null;
  } = {
    accepted: null,
    rejected: 0,
    lastErrors: [],
    thrown: null,
  };
  const maxAttempts = submit.maxAttempts ?? Number.POSITIVE_INFINITY;
  const submitTool = tool({
    description: submit.description,
    inputSchema: submit.schema,
    execute: async (value: z.infer<Schema>) => {
      let errors: string[];
      try {
        errors = await submit.check(value);
      } catch (error) {
        state.thrown = { error };
        throw error;
      }
      if (errors.length > 0) {
        state.rejected++;
        state.lastErrors = errors;
        return { accepted: false, errors };
      }
      state.accepted = { value };
      return { accepted: true };
    },
  });
  const result = await generateText({
    model,
    system,
    prompt,
    tools: { ...tools, [submit.name]: submitTool },
    toolChoice: "auto",
    stopWhen: [
      stepCountIs(maxSteps),
      () => state.accepted !== null || state.rejected >= maxAttempts || state.thrown !== null,
    ],
    providerOptions: { anthropic: { effort } },
    onStepFinish: (step) => {
      for (const call of step.toolCalls) onToolCall?.(call.toolName, call.input);
    },
  });
  const usage = {
    inputTokens: result.totalUsage.inputTokens ?? 0,
    outputTokens: result.totalUsage.outputTokens ?? 0,
    steps: result.steps.length,
  };
  if (state.thrown) throw state.thrown.error;
  if (!state.accepted) {
    const last = state.lastErrors.length > 0 ? `; last errors: ${state.lastErrors.join("; ")}` : "";
    throw new NoSubmissionError(
      `The model stopped after ${usage.steps} steps without an accepted ${submit.name}${last}`,
      result.text.trim()
    );
  }
  return { value: state.accepted.value, usage };
}
