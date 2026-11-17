import { z } from "zod";
import {
  MAX_CLIP_SECONDS,
  MAX_RECORDING_SECONDS,
  MAX_TRANSITION_SECONDS,
  TRANSITION_KINDS,
} from "./storyboard-limits";

export const BOARD_NODE_KINDS = ["recording", "text", "media"] as const;
export const RECORDING_START_MODES = ["fresh", "previous"] as const;

const id = z.string().min(1);

const nodeBase = {
  id,
  title: z.string().trim().min(1).max(80),
  /** Plain-language direction for the agent: what happens, what to emphasise. */
  notes: z.string().max(2000),
  /** Rough length the agent aims for. */
  duration: z.number().positive().max(MAX_CLIP_SECONDS),
  position: z.object({ x: z.number(), y: z.number() }),
};

export const boardNodeSchema = z.discriminatedUnion("kind", [
  z.object({
    ...nodeBase,
    kind: z.literal("recording"),
    duration: z.number().positive().max(MAX_RECORDING_SECONDS),
    /** A route from the route catalogue. */
    route: z.string().startsWith("/"),
    /** `previous` replays the recording node before this one, uncaptured, so a flow can span several clips. */
    startFrom: z.enum(RECORDING_START_MODES),
  }),
  z.object({
    ...nodeBase,
    kind: z.literal("text"),
    words: z.string().max(280),
    /** A text-effect catalogue id; the agent picks one when absent. */
    effect: z.string().min(1).optional(),
  }),
  z.object({
    ...nodeBase,
    kind: z.literal("media"),
    /** Project-relative file under `imports/`; empty until the author picks one. */
    file: z.string().min(1).optional(),
  }),
]);

export const boardEdgeSchema = z.object({
  id,
  from: id,
  to: id,
  transition: z.enum(TRANSITION_KINDS),
  transitionSeconds: z.number().min(0).max(MAX_TRANSITION_SECONDS),
});

export const boardSchema = z
  .object({
    nodes: z.array(boardNodeSchema),
    edges: z.array(boardEdgeSchema),
    /** Project-wide direction sent with the board. */
    brief: z.string().max(4000),
  })
  .superRefine((board, context) => {
    const ids = new Set(board.nodes.map((node) => node.id));
    if (ids.size !== board.nodes.length) context.addIssue({ code: "custom", message: "Duplicate node id" });
    for (const edge of board.edges) {
      if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to)
        context.addIssue({ code: "custom", message: `Edge ${edge.id} must join two different nodes` });
    }
  });

export const EMPTY_BOARD: Board = { nodes: [], edges: [], brief: "" };

export type BoardNode = z.infer<typeof boardNodeSchema>;
export type BoardNodeKind = (typeof BOARD_NODE_KINDS)[number];
export type BoardEdge = z.infer<typeof boardEdgeSchema>;
export type Board = z.infer<typeof boardSchema>;
