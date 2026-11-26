import { z } from "zod";
import { getTextEffect, listTextEffects } from "../catalogues/text-effects/text-effect-catalogue";
import type { DiscoveredPage } from "../discovery/page-discovery";
import { isAppPath } from "../recording/app-path";
import { boardOrder } from "../storyboard/board-order";
import {
  type Board,
  type BoardNode,
  boardEdgeSchema,
  boardNodeSchema,
  boardSchema,
} from "../storyboard/board-schema";
import { MAX_TRANSITION_SECONDS } from "../storyboard/storyboard-limits";
import { boardDraftSystemPrompt, boardDraftUserPrompt, SUBMIT_BOARD_TOOL } from "./board-draft-prompt";
import { NoSubmissionError, runUntilSubmitted } from "./submit-tool-loop";

export const NODE_SPACING = 200;
const MAX_DRAFT_STEPS = 4;

const [recordingNode, textNode, mediaNode] = boardNodeSchema.options;

/** What the model submits: the board without positions or edge ids, and why it chose these scenes. */
export const boardDraftSchema = z.object({
  brief: z.string().max(4000),
  rationale: z
    .string()
    .min(1)
    .max(1200)
    .describe("For the author, 2 to 4 short sentences: why these scenes, and what you left out and why."),
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

/** Asks the model for a draft; `check` lists what's wrong with one, for the model to fix. */
export type BoardPlanner = (request: {
  system: string;
  prompt: string;
  check: (draft: BoardDraft) => string[];
}) => Promise<BoardDraft>;

/** The text effects a scene may name: the visible ones in the catalogue. */
export function sceneEffectIds(): string[] {
  return listTextEffects()
    .filter((effect) => effect.visible)
    .map((effect) => effect.id);
}

type SceneFields =
  | { kind: "recording"; route: string }
  | { kind: "text"; effect?: string }
  | { kind: "media" };

/**
 * The rules a scene keeps beyond its schema, which every draft and edit is checked against: a recording opens a path
 * in the app, and a text effect is one the studio renders. (The schema caps a recording at its max seconds.)
 */
export function sceneRuleErrors(node: SceneFields, name: string): string[] {
  if (node.kind === "recording" && !isAppPath(node.route))
    return [`Scene "${name}" route ${node.route} isn't a path in the app, like /settings`];
  if (node.kind === "text" && node.effect && !getTextEffect(node.effect))
    return [
      `Scene "${name}" effect ${node.effect} isn't a text effect; use one of ${sceneEffectIds().join(", ")}`,
    ];
  return [];
}

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
    // Unknown effects are dropped below, so only the route can fail here.
    if (node.kind === "recording") errors.push(...sceneRuleErrors(node, node.id));
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
  const ordered = withFreshFirstRecording(boardOrder(unplaced)).map((node, index) => ({
    ...node,
    position: { x: 0, y: index * NODE_SPACING },
  }));
  const parsed = boardSchema.safeParse({ ...unplaced, nodes: ordered });
  if (!parsed.success) return { board: null, errors: parsed.error.issues.map((issue) => issue.message) };
  return { board: parsed.data, errors: [] };
}

/** Scenes in story order with the first recording starting fresh, since there's no recording before it to continue. */
export function withFreshFirstRecording(order: readonly BoardNode[]): BoardNode[] {
  let sawRecording = false;
  return order.map((node) => {
    if (node.kind !== "recording") return node;
    const startFrom = sawRecording ? node.startFrom : "fresh";
    sawRecording = true;
    return startFrom === node.startFrom ? node : { ...node, startFrom };
  });
}

const modelPlanner: BoardPlanner = async ({ system, prompt, check }) => {
  const { value } = await runUntilSubmitted({
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

/** A drafted board and the planner's reasons for it, for the agent to explain its choices. */
export type DraftedBoard = { board: Board; rationale: string };

/**
 * Drafts a board from the author's prompt, or revises `board`. Scenes may open any page of the app; `pages` are the
 * ones found by crawling it. When the model can't plan it, its reason is the error.
 */
export async function draftBoard({
  prompt,
  pages,
  appNotes = "",
  totalSeconds,
  board,
  planner = modelPlanner,
}: {
  prompt: string;
  pages: readonly DiscoveredPage[];
  /** What the author told the AI about their app when they made the project. */
  appNotes?: string;
  totalSeconds: number;
  board?: Board;
  planner?: BoardPlanner;
}): Promise<DraftedBoard> {
  const effects = listTextEffects()
    .filter((effect) => effect.visible)
    .map((effect) => ({ id: effect.id, description: effect.description }));
  const draft = await planner({
    system: boardDraftSystemPrompt({ pages, appNotes, effects, totalSeconds }),
    prompt: boardDraftUserPrompt({ prompt, board }),
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
  return { board: drafted, rationale: draft.rationale.trim() };
}
