import { z } from "zod";
import { boardSchema } from "../storyboard/board-schema";
import type { Clip } from "../storyboard/storyboard-schema";

export type NodeGenerationStatus = "queued" | "exploring" | "recording" | "done" | "failed";

/** One line of a generation job's output, and one SSE `data:` line; `{ done: true }` ends the stream. */
export type GenerationEvent =
  | {
      nodeId: string;
      status: NodeGenerationStatus;
      message?: string;
      /** 0..1 while recording. */
      progress?: number;
      /** The node's clips, with `done`; place them with `applyGeneratedClips`. */
      clips?: Clip[];
    }
  | { done: true; error?: string };

export const generateBoardRequestSchema = z.object({
  board: boardSchema,
  /** Only these nodes; every node when absent. */
  nodeIds: z.array(z.string().min(1)).min(1).optional(),
});

export type GenerateBoardRequest = z.infer<typeof generateBoardRequestSchema>;

export function isGenerationEnd(event: GenerationEvent): event is { done: true; error?: string } {
  return "done" in event;
}

export function parseGenerationEvent(line: string): GenerationEvent | null {
  try {
    const value: unknown = JSON.parse(line);
    if (value && typeof value === "object" && ("done" in value || "nodeId" in value))
      return value as GenerationEvent;
  } catch {
    return null;
  }
  return null;
}
