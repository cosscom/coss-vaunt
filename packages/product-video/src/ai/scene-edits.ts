import { z } from "zod";
import { DEFAULT_BOARD_TRANSITION, layoutBoard } from "../storyboard/board-edits";
import { boardOrder } from "../storyboard/board-order";
import { type Board, type BoardEdge, type BoardNode, boardNodeSchema } from "../storyboard/board-schema";
import {
  MAX_RECORDING_SECONDS,
  MAX_TRANSITION_SECONDS,
  TRANSITION_KINDS,
} from "../storyboard/storyboard-limits";
import { sceneRuleErrors, withFreshFirstRecording } from "./board-draft";

/**
 * The agent's direct edits to the board: one scene's fields, or the story order and its transitions, without the
 * planner. Each checks the same rules a draft is held to and returns the new board, or why it can't.
 */

const [recordingNode, textNode, mediaNode] = boardNodeSchema.options;

/** The fields of one scene the agent may change; leave out what stays. */
export const scenePatchSchema = z.object({
  title: recordingNode.shape.title.optional(),
  notes: recordingNode.shape.notes.optional(),
  duration: textNode.shape.duration
    .optional()
    .describe(`Seconds; a recording scene is at most ${MAX_RECORDING_SECONDS}`),
  words: textNode.shape.words.optional().describe("Text scenes: the words on screen, at most 12"),
  effect: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe("Text scenes: a text effect id, or null to let generation pick one"),
  route: recordingNode.shape.route.optional().describe("Recording scenes: the app path it opens on"),
  startFrom: recordingNode.shape.startFrom
    .optional()
    .describe("Recording scenes: fresh, or previous to continue"),
});

export type ScenePatch = z.infer<typeof scenePatchSchema>;

/** A new scene, without the id and position the board gives it. */
export const newSceneSchema = z.discriminatedUnion("kind", [
  recordingNode.omit({ id: true, position: true }),
  textNode.omit({ id: true, position: true }),
  mediaNode.omit({ id: true, position: true, file: true }),
]);

export type NewScene = z.infer<typeof newSceneSchema>;

export const transitionSchema = z.object({
  kind: z.enum(TRANSITION_KINDS),
  /** The overlap; a cut is always 0. */
  seconds: z.number().min(0).max(MAX_TRANSITION_SECONDS).optional(),
});

export type SceneEdit = { board: Board; summary: string } | { error: string };
type SceneUpdate = { node: BoardNode; summary: string } | { error: string };

const FIELDS_FOR: Record<BoardNode["kind"], readonly (keyof ScenePatch)[]> = {
  recording: ["title", "notes", "duration", "route", "startFrom"],
  text: ["title", "notes", "duration", "words", "effect"],
  media: ["title", "notes", "duration"],
};

const quoted = (node: BoardNode) => `“${node.title}”`;

function missing(sceneId: string): { error: string } {
  return { error: `There's no scene with id ${sceneId}.` };
}

/**
 * Why `sceneIds` can't be moved, retimed or removed: a scene whose clip is on a locked track stays as it is until
 * the author unlocks the track. Null when none is locked.
 */
export function lockedSceneError(
  board: Board,
  sceneIds: readonly string[],
  locked: ReadonlySet<string>
): { error: string } | null {
  const node = board.nodes.find((item) => sceneIds.includes(item.id) && locked.has(item.id));
  return node
    ? { error: `${quoted(node)} is on a locked track; ask the author to unlock it before changing it.` }
    : null;
}

/**
 * A scene after the checks every scene passes: its schema, the recording cap and the draft rules. With `board`, a
 * recording that continues the previous one needs a recording before it there.
 */
function checkedScene(node: BoardNode, board: Board | null): BoardNode | { error: string } {
  if (node.kind === "recording" && node.duration > MAX_RECORDING_SECONDS)
    return {
      error: `A recording scene is at most ${MAX_RECORDING_SECONDS} s; split a longer flow into scenes that continue from the previous one.`,
    };
  const parsed = boardNodeSchema.safeParse(node);
  if (!parsed.success)
    return {
      error: parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "scene"}: ${issue.message}`)
        .join("; "),
    };
  const [rule] = sceneRuleErrors(parsed.data, parsed.data.title);
  if (rule) return { error: rule };
  if (board && parsed.data.kind === "recording" && parsed.data.startFrom === "previous") {
    const order = boardOrder(board);
    const before = order.slice(
      0,
      order.findIndex((item) => item.id === node.id)
    );
    if (!before.some((item) => item.kind === "recording"))
      return {
        error: `${quoted(parsed.data)} has no recording before it to continue; use startFrom "fresh".`,
      };
  }
  return parsed.data;
}

/** One scene with `patch` applied; only that scene changes, and it keeps its id, kind and place. */
export function patchScene(board: Board, sceneId: string, patch: ScenePatch): SceneUpdate {
  const before = board.nodes.find((node) => node.id === sceneId);
  if (!before) return missing(sceneId);
  const fields = (Object.keys(patch) as (keyof ScenePatch)[]).filter((key) => patch[key] !== undefined);
  if (fields.length === 0) return { error: "The patch changes nothing." };
  const foreign = fields.filter((key) => !FIELDS_FOR[before.kind].includes(key));
  if (foreign.length > 0)
    return {
      error: `${quoted(before)} is a ${before.kind} scene, which has no ${foreign.join(" or ")}. It takes ${FIELDS_FOR[before.kind].join(", ")}.`,
    };
  const { effect, ...rest } = patch;
  const merged = {
    ...before,
    ...Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)),
  };
  if (merged.kind === "text" && effect !== undefined) {
    if (effect === null) delete merged.effect;
    else merged.effect = effect;
  }
  const node = checkedScene(merged as BoardNode, board);
  if ("error" in node) return node;
  return { node, summary: `Edited ${quoted(node)}: ${fields.join(", ")}` };
}

/** One scene set to `seconds` long. */
export function setSceneDuration(board: Board, sceneId: string, seconds: number): SceneUpdate {
  const result = patchScene(board, sceneId, { duration: seconds });
  return "error" in result
    ? result
    : { node: result.node, summary: `Set ${quoted(result.node)} to ${seconds} s` };
}

/**
 * The board with its scenes in `order`, joined as one chain in that order and laid out again. An edge between two
 * scenes that stay next to each other keeps its id and transition; a scene's old edge out moves to its new
 * follower; any other join gets the default transition. The first recording starts fresh.
 */
export function chainInOrder(board: Board, order: readonly BoardNode[], newId: () => string): Board {
  const pairs = order.slice(1).map((node, index) => [order[index] as BoardNode, node] as const);
  const claimed = new Set<string>();
  const kept = pairs.map(([from, to]) => {
    const edge = board.edges.find((item) => item.from === from.id && item.to === to.id);
    if (edge) claimed.add(edge.id);
    return edge;
  });
  const edges = pairs.map(([from, to], index): BoardEdge => {
    const exact = kept[index];
    if (exact) return exact;
    const moved = board.edges.find((item) => item.from === from.id && !claimed.has(item.id));
    if (moved) {
      claimed.add(moved.id);
      return { ...moved, to: to.id };
    }
    return { id: newId(), from: from.id, to: to.id, ...DEFAULT_BOARD_TRANSITION };
  });
  return layoutBoard({ ...board, nodes: withFreshFirstRecording(order), edges });
}

/** Where a 1-based story position lands in a list of `length`, clamped to it. */
function slot(position: number | undefined, length: number): number {
  if (position === undefined) return length;
  return Math.min(length, Math.max(0, Math.round(position) - 1));
}

/** Adds a scene at `position` in story order (1 is first; the end when left out). */
export function addScene(
  board: Board,
  scene: NewScene,
  position: number | undefined,
  newId: () => string
): SceneEdit {
  const order = boardOrder(board);
  const node = { ...scene, id: newId(), position: { x: 0, y: 0 } } as BoardNode;
  const index = slot(position, order.length);
  // A new recording with nothing before it to continue starts fresh (chainInOrder sees to it) rather than failing.
  const checked = checkedScene(node, null);
  if ("error" in checked) return checked;
  const next = [...order.slice(0, index), checked, ...order.slice(index)];
  return { board: chainInOrder(board, next, newId), summary: `Added ${quoted(node)} as scene ${index + 1}` };
}

/** Removes a scene; the scenes either side of it join up. */
export function removeScene(board: Board, sceneId: string, newId: () => string): SceneEdit {
  const node = board.nodes.find((item) => item.id === sceneId);
  if (!node) return missing(sceneId);
  // The edge into the removed scene carries on to the scene after it (chainInOrder moves a scene's edge out).
  const order = boardOrder(board).filter((item) => item.id !== sceneId);
  return { board: chainInOrder(board, order, newId), summary: `Removed ${quoted(node)}` };
}

/** Moves a scene to `position` in story order (1 is first). */
export function moveScene(board: Board, sceneId: string, position: number, newId: () => string): SceneEdit {
  const order = boardOrder(board);
  const node = order.find((item) => item.id === sceneId);
  if (!node) return missing(sceneId);
  const without = order.filter((item) => item.id !== sceneId);
  const index = slot(position, without.length);
  if (order[index]?.id === sceneId) return { error: `${quoted(node)} is already scene ${index + 1}.` };
  const next = [...without.slice(0, index), node, ...without.slice(index)];
  return { board: chainInOrder(board, next, newId), summary: `Moved ${quoted(node)} to scene ${index + 1}` };
}

/** Sets the transition between two scenes next to each other in story order. */
export function setTransition(
  board: Board,
  fromId: string,
  toId: string,
  { kind, seconds }: z.infer<typeof transitionSchema>,
  newId: () => string
): SceneEdit {
  const order = boardOrder(board);
  const index = order.findIndex((node) => node.id === fromId);
  const from = order[index];
  const to = board.nodes.find((node) => node.id === toId);
  if (!from) return missing(fromId);
  if (!to) return missing(toId);
  const after = order[index + 1];
  if (after?.id !== toId)
    return {
      error: after
        ? `${quoted(to)} doesn't follow ${quoted(from)}; a transition joins consecutive scenes, and ${quoted(after)} comes next.`
        : `${quoted(from)} is the last scene; nothing follows it.`,
    };
  const existing = board.edges.find((edge) => edge.from === fromId && edge.to === toId);
  const transitionSeconds =
    kind === "cut"
      ? 0
      : (seconds ?? existing?.transitionSeconds ?? DEFAULT_BOARD_TRANSITION.transitionSeconds);
  const edge: BoardEdge = {
    id: existing?.id ?? newId(),
    from: fromId,
    to: toId,
    transition: kind,
    transitionSeconds: Math.min(MAX_TRANSITION_SECONDS, transitionSeconds),
  };
  const edges = existing
    ? board.edges.map((item) => (item.id === existing.id ? edge : item))
    : [...board.edges, edge];
  const shown = kind === "cut" ? "a cut" : `${kind}, ${edge.transitionSeconds} s`;
  return {
    board: layoutBoard({ ...board, edges }),
    summary: `Set the transition from ${quoted(from)} to ${quoted(to)} to ${shown}`,
  };
}

/** The story order as the agent reads it back: position, title, kind, length and id. */
export function storyLines(board: Board): string[] {
  return boardOrder(board).map(
    (node, index) => `${index + 1}. ${node.title} (${node.kind}, ${node.duration} s), id ${node.id}`
  );
}
