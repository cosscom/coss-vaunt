import {
  BOARD_NODE_SIZE,
  BOARD_ROW_GAP,
  DEFAULT_BOARD_TRANSITION,
  removeBoardNodes,
  reorderBoardNode,
} from "./board-edits";
import { boardOrder } from "./board-order";
import { type Board, type BoardEdge, type BoardNode, boardSchema, EMPTY_BOARD } from "./board-schema";
import {
  findClipLocation,
  incomingOverlap,
  maxOverlap,
  removeClips,
  setClipDuration,
  setTransitionLength,
  spansAreValid,
  updateClip,
} from "./storyboard-edits";
import { type Clip, MAX_TRANSITION_SECONDS, type Project, type TransitionKind } from "./storyboard-schema";
import { clipEnd } from "./track-resolution";

/*
 * The board is a view of the timeline. Every video clip is a scene, bound to its node by `storyboardNodeId`;
 * scene order, durations and the transitions between scenes come from the clips. A node with no clip is a draft
 * the author hasn't generated yet, and keeps its place after the scene before it. What a node has that the
 * timeline doesn't (title, notes, route, words, file) stays on the node, so regenerating a scene uses it.
 */

const EPSILON = 1e-6;
const ROW = BOARD_NODE_SIZE.height + BOARD_ROW_GAP;

type Scene = { clip: Clip; trackIndex: number };
type Transition = { transition: TransitionKind; transitionSeconds: number };

/** Every video clip in play order: by start, the lower track first. */
function scenesInOrder(project: Project): Scene[] {
  return project.videoTracks
    .flatMap((track, trackIndex) => track.clips.map((clip) => ({ clip, trackIndex })))
    .sort((a, b) => a.clip.start - b.clip.start || a.trackIndex - b.trackIndex);
}

/** Each node's clip, the earliest when several still share one. */
function clipsByNode(project: Project): Map<string, Clip> {
  const clips = new Map<string, Clip>();
  for (const { clip } of scenesInOrder(project)) {
    if (clip.storyboardNodeId && !clips.has(clip.storyboardNodeId)) clips.set(clip.storyboardNodeId, clip);
  }
  return clips;
}

function kindOf(clip: Clip): BoardNode["kind"] {
  if (clip.source.kind === "recording") return "recording";
  if (clip.source.kind === "text") return "text";
  return "media";
}

/** The node for a clip: `template`'s direction when it's the same kind of scene, else what the clip shows. */
function nodeForClip(clip: Clip, id: string, template: BoardNode | undefined): BoardNode {
  if (template?.kind === kindOf(clip)) {
    if (template.id === id && template.duration === clip.duration) return template;
    return { ...template, id, duration: clip.duration };
  }
  const base = {
    id,
    title: template?.title ?? clip.name,
    notes: template?.notes ?? "",
    duration: clip.duration,
    position: template?.position ?? { x: 0, y: 0 },
  };
  const { source } = clip;
  if (source.kind === "recording")
    return {
      ...base,
      kind: "recording",
      route: source.route,
      startFrom: source.startFrom ? "previous" : "fresh",
    };
  if (source.kind === "text") return { ...base, kind: "text", words: source.text, effect: source.effectIn };
  return { ...base, kind: "media", file: source.file };
}

/** The transition into `to` from `from`: the clips' overlap on one track, else a cut. */
function transitionBetween(from: Scene, to: Scene): Transition {
  const overlap = clipEnd(from.clip) - to.clip.start;
  if (from.trackIndex !== to.trackIndex || overlap <= EPSILON)
    return { transition: "cut", transitionSeconds: 0 };
  return {
    transition: to.clip.transitionIn,
    transitionSeconds: Math.min(MAX_TRANSITION_SECONDS, Math.round(overlap * 1000) / 1000),
  };
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  for (let index = 2; taken.has(id); index++) id = `${base}-${index}`;
  taken.add(id);
  return id;
}

/** Groups of nodes joined by edges, as a component id per node. */
function components(board: Board): Map<string, string> {
  const parent = new Map(board.nodes.map((node) => [node.id, node.id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root) ?? root;
    parent.set(id, root);
    return root;
  };
  for (const edge of board.edges) {
    if (parent.has(edge.from) && parent.has(edge.to)) parent.set(find(edge.from), find(edge.to));
  }
  return new Map(board.nodes.map((node) => [node.id, find(node.id)]));
}

const sameIds = (a: readonly { id: string }[], b: readonly { id: string }[]) =>
  a.length === b.length && a.every((item, index) => item.id === b[index]?.id);

/**
 * The board as the timeline shows it. Every clip gets a scene: its own node, or a copy of it when an earlier clip
 * already has that node (a duplicate, a paste, the second half of a split), or a new one made from the clip. A node
 * whose clips were in `previous` but are gone was deleted on the timeline and goes too, unless it's in `keep` (being
 * generated). The scenes and the drafts between them form one sequence in timeline order; drafts not joined to
 * any scene stay where the author put them. Returns `project` itself when the board already matches.
 */
export function reconcileBoard(
  previous: Project,
  project: Project,
  { keep = new Set() }: { keep?: ReadonlySet<string> } = {}
): Project {
  const scenes = scenesInOrder(project);
  if (!project.storyboard && scenes.length === 0) return project;
  const board = project.storyboard ?? EMPTY_BOARD;
  const existing = new Map(board.nodes.map((node) => [node.id, node]));

  const taken = new Set(board.nodes.map((node) => node.id));
  const bound = new Map<string, Scene>();
  const nodes = new Map<string, BoardNode>();
  const rebound = new Map<string, string>();
  for (const scene of scenes) {
    const own = scene.clip.storyboardNodeId;
    const nodeId = own && !bound.has(own) ? own : uniqueId(scene.clip.id, taken);
    taken.add(nodeId);
    bound.set(nodeId, scene);
    if (nodeId !== own) rebound.set(scene.clip.id, nodeId);
    nodes.set(nodeId, nodeForClip(scene.clip, nodeId, own ? existing.get(own) : undefined));
  }

  const hadClips = new Set(scenesInOrder(previous).map(({ clip }) => clip.storyboardNodeId));
  const deleted = board.nodes
    .filter((node) => !bound.has(node.id) && hadClips.has(node.id) && !keep.has(node.id))
    .map((node) => node.id);
  const remaining = removeBoardNodes(board, deleted);

  // Drafts joined to a scene belong to the sequence and follow the scene before them in the board's order.
  const component = components(remaining);
  const sequenced = new Set([...bound.keys()].map((id) => component.get(id)).filter(Boolean));
  const inSequence = (node: BoardNode) => bound.has(node.id) || sequenced.has(component.get(node.id));
  const order = boardOrder(remaining).filter(inSequence);
  const leading: BoardNode[] = [];
  const following = new Map<string, BoardNode[]>();
  let last: string | null = null;
  for (const node of order) {
    if (bound.has(node.id)) last = node.id;
    else if (last) following.set(last, [...(following.get(last) ?? []), node]);
    else leading.push(node);
  }
  const sequence = [
    ...leading,
    ...[...bound.keys()].flatMap((id) => [nodes.get(id) as BoardNode, ...(following.get(id) ?? [])]),
  ];

  // Placed in one column when the sequence changed; nodes keep their column, new ones take the one above.
  let placed = sequence;
  if (!sameIds(sequence, order)) {
    const ys = order.map((node) => node.position.y);
    const lowestOther = Math.max(
      ...remaining.nodes.filter((node) => !inSequence(node)).map((node) => node.position.y)
    );
    // Below the drafts that stay put when no scene was on the board yet.
    const below = Number.isFinite(lowestOther) ? lowestOther + ROW : 0;
    const top = ys.length > 0 ? Math.min(...ys) : below;
    let x = order[0]?.position.x ?? 0;
    placed = sequence.map((node, index) => {
      if (existing.has(node.id)) x = node.position.x;
      const position = { x, y: top + index * ROW };
      return node.position.x === position.x && node.position.y === position.y ? node : { ...node, position };
    });
  }

  const edgeIds = new Set(remaining.edges.map((edge) => edge.id));
  const between = new Map(remaining.edges.map((edge) => [`${edge.from}\n${edge.to}`, edge]));
  const sequenceEdges = placed.slice(1).map((node, index): BoardEdge => {
    const from = placed[index];
    const old = between.get(`${from.id}\n${node.id}`);
    const fromScene = bound.get(from.id);
    const toScene = bound.get(node.id);
    const transition =
      fromScene && toScene ? transitionBetween(fromScene, toScene) : (old ?? DEFAULT_BOARD_TRANSITION);
    if (old?.transition === transition.transition && old.transitionSeconds === transition.transitionSeconds)
      return old;
    return {
      id: old?.id ?? uniqueId(`${from.id}->${node.id}`, edgeIds),
      from: from.id,
      to: node.id,
      transition: transition.transition,
      transitionSeconds: transition.transitionSeconds,
    };
  });

  const outside = remaining.nodes.filter((node) => !inSequence(node));
  const outsideIds = new Set(outside.map((node) => node.id));
  const next: Board = {
    ...remaining,
    nodes: inBoardOrder(board.nodes, [...placed, ...outside]),
    edges: inBoardOrder(board.edges, [
      ...sequenceEdges,
      ...remaining.edges.filter((edge) => outsideIds.has(edge.from) && outsideIds.has(edge.to)),
    ]),
  };
  const storyboard =
    project.storyboard && JSON.stringify(next) === JSON.stringify(project.storyboard)
      ? project.storyboard
      : next;
  if (storyboard === project.storyboard && rebound.size === 0) return project;
  if (!boardSchema.safeParse(storyboard).success) return project;
  return {
    ...project,
    storyboard,
    videoTracks:
      rebound.size === 0
        ? project.videoTracks
        : project.videoTracks.map((track) =>
            track.clips.some((clip) => rebound.has(clip.id))
              ? {
                  ...track,
                  clips: track.clips.map((clip) => {
                    const nodeId = rebound.get(clip.id);
                    return nodeId ? { ...clip, storyboardNodeId: nodeId } : clip;
                  }),
                }
              : track
          ),
  };
}

/** `items` in the order the same ids had in `original`, new ones after, so an unchanged board compares equal. */
function inBoardOrder<T extends { id: string }>(original: readonly T[], items: T[]): T[] {
  const index = new Map(original.map((item, position) => [item.id, position]));
  return [...items].sort(
    (a, b) => (index.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (index.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  );
}

/** Sets the cut into `toId` from `fromId` when `fromId`'s clip is the one before it on its track. */
function setSceneTransition(project: Project, fromId: string, toId: string, edge: Transition): Project {
  const location = findClipLocation(project, toId);
  if (!location) return project;
  const before = location.track.clips
    .filter((clip) => clip.start < location.clip.start - EPSILON)
    .sort((a, b) => clipEnd(b) - clipEnd(a))[0];
  if (before?.id !== fromId) return project;
  // A transition picked on a cut gets the default length, or the clips wouldn't overlap to play it.
  const length =
    edge.transitionSeconds > 0 ? edge.transitionSeconds : DEFAULT_BOARD_TRANSITION.transitionSeconds;
  const seconds = edge.transition === "cut" ? 0 : length;
  const moved = setTransitionLength(project, toId, seconds);
  return updateClip(moved, toId, (clip) =>
    edge.transition === "cut" ? clip : { ...clip, transitionIn: edge.transition }
  );
}

/**
 * Why a board edit couldn't be carried over to the timeline: the scenes to reorder are on different tracks, other
 * clips sit between them (or a scene has several clips), or the new order breaks the overlap rules.
 */
export type BoardRefusal = "scenes-span-tracks" | "scenes-not-together" | "order-breaks-overlaps";

export type BoardSync = { project: Project; refused: BoardRefusal[] };

type BoardSyncOptions = {
  /** Scenes being generated: the board keeps them while their clips are replaced. */
  keep?: ReadonlySet<string>;
  /**
   * The board was replaced wholesale (a draft, or undoing one): scenes it leaves out or puts in another order keep
   * their clips where they are, and the timeline brings them back.
   */
  replace?: boolean;
};

/** How far `clip` starts after the end of `previous`: negative when they overlap, kept within the overlap rules. */
function clampedJoin(join: number, previous: Clip | undefined, clip: Clip): number {
  if (!previous || join >= 0) return Math.max(0, join);
  return -Math.min(-join, maxOverlap(previous.duration, clip.duration));
}

/**
 * Re-lays the clips of `nodeIds` in that order, when each scene has one clip and they sit together on one video
 * track. The run starts where it did; each clip keeps its duration, its transition and the gap or overlap before it
 * (an overlap clamped to the rules), and the clips after the run move with its end.
 */
export function resequenceScenes(
  project: Project,
  nodeIds: readonly string[]
): { project: Project } | { refused: BoardRefusal } {
  const wanted = new Set(nodeIds);
  const found = project.videoTracks.flatMap((track, trackIndex) =>
    track.clips
      .filter((clip) => clip.storyboardNodeId && wanted.has(clip.storyboardNodeId))
      .map((clip) => ({ clip, trackIndex }))
  );
  if (new Set(found.map(({ trackIndex }) => trackIndex)).size > 1) return { refused: "scenes-span-tracks" };
  if (found.length !== nodeIds.length) return { refused: "scenes-not-together" };
  if (found.length < 2) return { project };
  const { trackIndex } = found[0];
  const track = project.videoTracks[trackIndex];
  const sorted = [...track.clips].sort((a, b) => a.start - b.start);
  const indexes = found.map(({ clip }) => sorted.indexOf(clip));
  const first = Math.min(...indexes);
  const last = Math.max(...indexes);
  if (last - first + 1 !== found.length) return { refused: "scenes-not-together" };

  const run = sorted.slice(first, last + 1);
  const before = sorted[first - 1];
  const after = sorted.slice(last + 1);
  // The join into each clip; the first one's, from the clip before the run, is the run's slot and goes with the
  // clip that takes it.
  const joins = new Map(
    run.map((clip, index) => {
      const previous = index === 0 ? before : run[index - 1];
      return [clip.id, previous ? clip.start - clipEnd(previous) : 0];
    })
  );
  const byNode = new Map(run.map((clip) => [clip.storyboardNodeId, clip]));
  const order = nodeIds.map((id) => byNode.get(id) as Clip);
  const placed: Clip[] = [];
  for (const [index, clip] of order.entries()) {
    const previous = placed[index - 1] ?? before;
    const join = index === 0 ? run[0].start - (before ? clipEnd(before) : 0) : (joins.get(clip.id) ?? 0);
    const start = (previous ? clipEnd(previous) : 0) + clampedJoin(join, previous, clip);
    placed.push(clip.start === start ? clip : { ...clip, start });
  }
  const next = after[0];
  const shift = next
    ? clipEnd(placed[placed.length - 1]) +
      clampedJoin(next.start - clipEnd(run[run.length - 1]), placed[placed.length - 1], next) -
      next.start
    : 0;
  const moved =
    Math.abs(shift) < EPSILON ? after : after.map((clip) => ({ ...clip, start: clip.start + shift }));
  const clips = [...sorted.slice(0, first), ...placed, ...moved];
  if (!spansAreValid(clips)) return { refused: "order-breaks-overlaps" };
  if (clips.every((clip, index) => clip === sorted[index])) return { project };
  return {
    project: {
      ...project,
      videoTracks: project.videoTracks.map((other, index) =>
        index === trackIndex ? { ...other, clips } : other
      ),
    },
  };
}

const pairOf = (edge: { from: string; to: string }) => `${edge.from}\n${edge.to}`;

/**
 * Edges between two scenes with clips that an edit only took out, joining nothing new: deleting the join between
 * two scenes makes it a cut, so the scenes stay in order and the edge comes back as one.
 */
function deletedJoins(previous: Board, board: Board, bound: ReadonlySet<string>): BoardEdge[] {
  const pairs = new Set(board.edges.map(pairOf));
  const before = new Set(previous.edges.map(pairOf));
  if (board.edges.some((edge) => !before.has(pairOf(edge)))) return [];
  const outs = new Set(board.edges.map((edge) => edge.from));
  const ins = new Set(board.edges.map((edge) => edge.to));
  return previous.edges.filter(
    (edge) =>
      bound.has(edge.from) &&
      bound.has(edge.to) &&
      !pairs.has(pairOf(edge)) &&
      !outs.has(edge.from) &&
      !ins.has(edge.to)
  );
}

/**
 * The order of the scenes with clips the edited board asks for, or null when its joins didn't change. One new
 * join between two scenes is a connection, which moves the second scene to right after the first; otherwise it's
 * the board's own story order, with the drafts and sequences not joined to any scene left out.
 */
function askedOrder(
  previous: Board,
  board: Board,
  current: readonly string[],
  bound: ReadonlySet<string>,
  cuts: readonly BoardEdge[]
): string[] | null {
  const sameNodes = sameIds(previous.nodes, board.nodes);
  if (sameNodes && JSON.stringify(previous.edges) === JSON.stringify(board.edges)) return null;
  const withCuts = { ...board, edges: [...board.edges, ...cuts] };
  const component = components(withCuts);
  const sequenced = new Set([...bound].map((id) => component.get(id)));
  const nodes = withCuts.nodes.filter((node) => sequenced.has(component.get(node.id)));
  const ids = new Set(nodes.map((node) => node.id));
  const edges = withCuts.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
  const ins = new Set(edges.map((edge) => edge.to));
  const pairs = new Set(previous.edges.map(pairOf));
  const joined = edges.filter(
    (edge) => !pairs.has(pairOf(edge)) && bound.has(edge.from) && bound.has(edge.to)
  );
  // A connection leaves the scenes that followed `from` without a way in; a whole new chain has one start.
  if (joined.length === 1 && nodes.filter((node) => !ins.has(node.id)).length > 1) {
    const [{ from, to }] = joined;
    const without = current.filter((id) => id !== to);
    const at = without.indexOf(from) + 1;
    return [...without.slice(0, at), to, ...without.slice(at)];
  }
  return boardOrder({ ...withCuts, nodes, edges })
    .map((node) => node.id)
    .filter((id) => bound.has(id));
}

/** Ends the overlap into `clipId` by moving it, and every clip after it on its track, later by that much. */
function cutInto(project: Project, clipId: string): Project {
  const location = findClipLocation(project, clipId);
  if (!location) return project;
  const overlap = incomingOverlap(location.track, clipId);
  if (overlap <= EPSILON) return project;
  const from = location.clip.start;
  return {
    ...project,
    videoTracks: project.videoTracks.map((track, index) =>
      index === location.trackIndex
        ? {
            ...track,
            clips: track.clips.map((clip) =>
              clip.start >= from - EPSILON ? { ...clip, start: clip.start + overlap } : clip
            ),
          }
        : track
    ),
  };
}

/**
 * Carries board edits that have a timeline equivalent over to the clips: a scene's new duration trims its clip, a
 * new transition on the edge between two neighbouring clips sets their overlap, a removed scene takes its clips with
 * it, a deleted join between two scenes becomes a cut, and a new story order (a move, or a connection to a scene
 * further on) re-lays their clips. What can't be carried over is in `refused`; the board then follows the timeline.
 */
export function applyBoardEdits(
  before: Project,
  after: Project,
  { replace = false }: Pick<BoardSyncOptions, "replace"> = {}
): BoardSync {
  const previous = before.storyboard;
  const board = after.storyboard;
  if (!previous || !board || previous === board) return { project: after, refused: [] };
  let next = after;
  const refused: BoardRefusal[] = [];

  if (!replace) {
    const kept = new Set(board.nodes.map((node) => node.id));
    const gone = new Set(previous.nodes.filter((node) => !kept.has(node.id)).map((node) => node.id));
    const clipIds = next.videoTracks.flatMap((track) =>
      track.clips
        .filter((clip) => clip.storyboardNodeId && gone.has(clip.storyboardNodeId))
        .map((clip) => clip.id)
    );
    if (clipIds.length > 0) next = removeClips(next, clipIds);
  }

  const clips = clipsByNode(next);
  const oldNodes = new Map(previous.nodes.map((node) => [node.id, node]));
  for (const node of board.nodes) {
    const was = oldNodes.get(node.id);
    const clip = clips.get(node.id);
    if (!was || !clip || was.duration === node.duration || Math.abs(clip.duration - node.duration) < EPSILON)
      continue;
    next = setClipDuration(next, clip.id, node.duration);
  }
  const oldEdges = new Map(previous.edges.map((edge) => [edge.id, edge]));
  for (const edge of board.edges) {
    const was = oldEdges.get(edge.id);
    const from = clips.get(edge.from);
    const to = clips.get(edge.to);
    if (!was || !from || !to || was.from !== edge.from || was.to !== edge.to) continue;
    if (was.transition === edge.transition && was.transitionSeconds === edge.transitionSeconds) continue;
    next = setSceneTransition(next, from.id, to.id, edge);
  }
  if (replace) return { project: next, refused };

  const onBoard = new Set(board.nodes.map((node) => node.id));
  const bound = new Set([...clips.keys()].filter((id) => onBoard.has(id)));
  const cuts = deletedJoins(previous, board, bound);
  for (const edge of cuts) {
    const to = clips.get(edge.to);
    if (to) next = cutInto(next, to.id);
  }

  const current = [...clipsByNode(next).keys()].filter((id) => bound.has(id));
  const asked = askedOrder(previous, board, current, bound, cuts);
  if (
    asked &&
    !sameIds(
      asked.map((id) => ({ id })),
      current.map((id) => ({ id }))
    )
  ) {
    // Only the stretch that changed is re-laid, so a move doesn't need every scene on one track.
    let first = 0;
    while (asked[first] === current[first]) first++;
    let last = asked.length - 1;
    while (asked[last] === current[last]) last--;
    const result = resequenceScenes(next, asked.slice(first, last + 1));
    if ("refused" in result) refused.push(result.refused);
    else next = result.project;
  }
  return { project: next, refused };
}

/**
 * One edit's effect on the board: board edits carried to the timeline, then the board matched to it, with what
 * couldn't be carried over.
 */
export function syncBoardEdits(before: Project, after: Project, options: BoardSyncOptions = {}): BoardSync {
  const { project, refused } = applyBoardEdits(before, after, options);
  return { project: reconcileBoard(before, project, options), refused };
}

/** One edit's effect on the board, as `syncBoardEdits`, for callers that don't report what was refused. */
export function syncBoard(before: Project, after: Project, options: BoardSyncOptions = {}): Project {
  return syncBoardEdits(before, after, options).project;
}

/**
 * Moves a scene one step along the sequence on the board; the sync re-lays two scenes' clips to match (see
 * `resequenceScenes`), and when either is a draft only the board changes.
 */
export function reorderScene(project: Project, nodeId: string, direction: -1 | 1): Project {
  const board = project.storyboard;
  if (!board) return project;
  const next = reorderBoardNode(board, nodeId, direction);
  return next === board ? project : { ...project, storyboard: next };
}
