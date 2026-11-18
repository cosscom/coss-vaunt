import { z } from "zod";
import {
  findRouteEntry,
  isAppPath,
  ROUTE_CATALOGUE,
  type RouteCatalogueEntry,
} from "../catalogues/routes/route-catalogue";
import { getTextEffect, listTextEffects } from "../catalogues/text-effects/text-effect-catalogue";
import { boardOrder } from "../storyboard/board-order";
import { type Board, boardEdgeSchema, boardNodeSchema, boardSchema } from "../storyboard/board-schema";
import { MAX_TRANSITION_SECONDS } from "../storyboard/storyboard-limits";
import { boardDraftSystemPrompt, boardDraftUserPrompt, SUBMIT_BOARD_TOOL } from "./board-draft-prompt";
import { studioModel } from "./studio-model";
import { NoSubmissionError, runUntilSubmitted } from "./submit-tool-loop";

export const NODE_SPACING = 200;
const MAX_DRAFT_STEPS = 4;

const [recordingNode, textNode, mediaNode] = boardNodeSchema.options;

/** What the model submits: the board without positions or edge ids. */
export const boardDraftSchema = z.object({
  brief: z.string().max(4000),
  nodes: z
    .array(
      z.discriminatedUnion("kind", [
        recordingNode.omit({ position: true }),
        textNode.omit({ position: true }),
        mediaNode.omit({ position: true }),
      ])
    )
    .min(1)
    .max(12),
  edges: z.array(boardEdgeSchema.omit({ id: true })),
});

export type BoardDraft = z.infer<typeof boardDraftSchema>;

/** The body of a draft request: the author's prompt, pages to feature (any app paths), the target length. */
export const draftBoardRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  routes: z.array(z.string().startsWith("/")).max(20).default([]),
  totalSeconds: z.number().min(5).max(180),
  board: boardSchema.optional(),
  /** Revise just this scene of `board`. */
  focusNodeId: z.string().optional(),
});

/** Asks the model for a draft; `check` lists what's wrong with one, for the model to fix. */
export type BoardPlanner = (request: {
  system: string;
  prompt: string;
  check: (draft: BoardDraft) => string[];
}) => Promise<BoardDraft>;

/**
 * Turns a draft into a board: rejects routes that aren't app paths, drops unknown effects (generation picks one),
 * starts the first recording fresh, drops edges that don't join two scenes, keeps ids of revised scenes and
 * lays the scenes out top to bottom in story order.
 */
export function repairBoardDraft(
  draft: BoardDraft,
  { existing, newId = () => crypto.randomUUID() }: { existing?: Board; newId?: () => string } = {}
): { board: Board | null; errors: string[] } {
  const errors: string[] = [];
  const existingIds = new Set(existing?.nodes.map((node) => node.id));
  const ids = new Map<string, string>();
  for (const node of draft.nodes) {
    if (ids.has(node.id)) errors.push(`Scene id "${node.id}" is used twice`);
    ids.set(node.id, existingIds.has(node.id) ? node.id : newId());
    if (node.kind === "recording" && !isAppPath(node.route)) {
      errors.push(`Scene "${node.id}" route ${node.route} isn't a path in the app, like /bookings/upcoming`);
    }
  }
  if (errors.length > 0) return { board: null, errors };

  const seen = new Set<string>();
  const edges = draft.edges.flatMap((edge) => {
    const from = ids.get(edge.from);
    const to = ids.get(edge.to);
    const key = `${from}>${to}`;
    if (!from || !to || from === to || seen.has(key)) return [];
    seen.add(key);
    const transitionSeconds =
      edge.transition === "cut" ? 0 : Math.min(MAX_TRANSITION_SECONDS, Math.max(0, edge.transitionSeconds));
    return [{ id: newId(), from, to, transition: edge.transition, transitionSeconds }];
  });
  const nodes = draft.nodes.map((node, index) => {
    const position = { x: 0, y: index * NODE_SPACING };
    const id = ids.get(node.id) ?? newId();
    if (node.kind === "text" && node.effect && !getTextEffect(node.effect)) {
      const { effect: _unknown, ...rest } = node;
      return { ...rest, id, position };
    }
    return { ...node, id, position };
  });
  const unplaced: Board = { brief: draft.brief, nodes, edges };
  let sawRecording = false;
  const ordered = boardOrder(unplaced).map((node, index) => {
    const position = { x: 0, y: index * NODE_SPACING };
    if (node.kind !== "recording") return { ...node, position };
    const startFrom = sawRecording ? node.startFrom : "fresh";
    sawRecording = true;
    return { ...node, startFrom, position };
  });
  const parsed = boardSchema.safeParse({ ...unplaced, nodes: ordered });
  if (!parsed.success) return { board: null, errors: parsed.error.issues.map((issue) => issue.message) };
  return { board: parsed.data, errors: [] };
}

const modelPlanner: BoardPlanner = async ({ system, prompt, check }) => {
  const { value } = await runUntilSubmitted({
    model: studioModel("plan"),
    system,
    prompt,
    maxSteps: MAX_DRAFT_STEPS,
    effort: "high",
    submit: {
      name: SUBMIT_BOARD_TOOL,
      description: "Submit the whole storyboard. Returns errors to fix, or accepted.",
      schema: boardDraftSchema,
      check,
    },
  });
  return value;
};

export class BoardDraftError extends Error {}

/**
 * Drafts a board from the author's prompt, or revises `board`. Scenes may open any page of the app; `routes` picks
 * the tuned pages to describe in detail (all of them when empty). When the model can't plan it, its reason is the error.
 */
export async function draftBoard({
  prompt,
  routes,
  totalSeconds,
  board,
  focusNodeId,
  planner = modelPlanner,
}: {
  prompt: string;
  routes: readonly string[];
  totalSeconds: number;
  board?: Board;
  focusNodeId?: string;
  planner?: BoardPlanner;
}): Promise<Board> {
  const notPaths = routes.filter((route) => !isAppPath(route));
  if (notPaths.length > 0) throw new BoardDraftError(`Not paths in the app: ${notPaths.join(", ")}`);
  const tuned = routes
    .map((route) => findRouteEntry(route))
    .filter((entry): entry is RouteCatalogueEntry => entry !== null);
  const known = tuned.length > 0 ? tuned : ROUTE_CATALOGUE;
  const effects = listTextEffects()
    .filter((effect) => effect.visible)
    .map((effect) => ({ id: effect.id, description: effect.description }));
  const draft = await planner({
    system: boardDraftSystemPrompt({ routes: known, effects, totalSeconds }),
    prompt: boardDraftUserPrompt({ prompt, board, focusNodeId }),
    check: (candidate) => repairBoardDraft(candidate, { existing: board }).errors,
  }).catch((error: unknown) => {
    if (error instanceof NoSubmissionError) {
      throw new BoardDraftError(
        error.reply || "The planner couldn't make a board for this request. Try rephrasing it."
      );
    }
    throw error;
  });
  const { board: drafted, errors } = repairBoardDraft(draft, { existing: board });
  if (!drafted) throw new BoardDraftError(`The draft board is invalid: ${errors.join("; ")}`);
  return drafted;
}
