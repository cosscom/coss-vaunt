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
 * Carries board edits that have a timeline equivalent over to the clips: a scene's new duration trims its clip,
 * and a new transition on the edge between two neighbouring clips sets their overlap.
 */
export function applyBoardEdits(before: Project, after: Project): Project {
  const previous = before.storyboard;
  const board = after.storyboard;
  if (!previous || !board || previous === board) return after;
  const clips = clipsByNode(after);
  let next = after;
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
    if (!was || !from || !to) continue;
    if (was.transition === edge.transition && was.transitionSeconds === edge.transitionSeconds) continue;
    next = setSceneTransition(next, from.id, to.id, edge);
  }
  return next;
}

/** One edit's effect on the board: board edits carried to the timeline, then the board matched to it. */
export function syncBoard(
  before: Project,
  after: Project,
  options: { keep?: ReadonlySet<string> } = {}
): Project {
  return reconcileBoard(before, applyBoardEdits(before, after), options);
}

/** Removes scenes from the board and their clips from the timeline. */
export function removeScenes(
  project: Project,
  nodeIds: readonly string[],
  edgeIds: readonly string[] = []
): Project {
  const removed = new Set(nodeIds);
  const clipIds = project.videoTracks.flatMap((track) =>
    track.clips
      .filter((clip) => clip.storyboardNodeId && removed.has(clip.storyboardNodeId))
      .map((clip) => clip.id)
  );
  return {
    ...removeClips(project, clipIds),
    storyboard: removeBoardNodes(project.storyboard ?? EMPTY_BOARD, nodeIds, edgeIds),
  };
}

/**
 * Swaps `firstId`'s clip with the clip after it on the same track, keeping the gap or overlap between them and
 * each start's transition; null when they aren't neighbours or the swap breaks the overlap rules.
 */
function swapClips(project: Project, firstId: string, secondId: string): Project | null {
  const first = findClipLocation(project, firstId);
  const second = findClipLocation(project, secondId);
  if (!first || !second || first.trackIndex !== second.trackIndex) return null;
  const between = first.track.clips.some(
    (clip) => clip.start > first.clip.start + EPSILON && clip.start < second.clip.start - EPSILON
  );
  if (between || second.clip.start < first.clip.start) return null;
  const gap = second.clip.start - clipEnd(first.clip);
  const swapped: Record<string, Clip> = {
    [secondId]: { ...second.clip, start: first.clip.start, transitionIn: first.clip.transitionIn },
    [firstId]: {
      ...first.clip,
      start: first.clip.start + second.clip.duration + gap,
      transitionIn: second.clip.transitionIn,
    },
  };
  const clips = first.track.clips.map((clip) => swapped[clip.id] ?? clip).sort((a, b) => a.start - b.start);
  if (!spansAreValid(clips)) return null;
  return {
    ...project,
    videoTracks: project.videoTracks.map((track, index) =>
      index === first.trackIndex ? { ...track, clips } : track
    ),
  };
}

/**
 * Moves a scene one step along the sequence. Two scenes with clips swap clips on the timeline, which the board
 * then follows; when either is a draft only the board changes.
 */
export function reorderScene(project: Project, nodeId: string, direction: -1 | 1): Project {
  const board = project.storyboard;
  if (!board) return project;
  const order = boardOrder(board);
  const index = order.findIndex((node) => node.id === nodeId);
  const other = order[index + direction];
  if (index < 0 || !other) return project;
  const [first, second] = direction === 1 ? [order[index], other] : [other, order[index]];
  const clips = clipsByNode(project);
  const firstClip = clips.get(first.id);
  const secondClip = clips.get(second.id);
  if (!firstClip || !secondClip)
    return { ...project, storyboard: reorderBoardNode(board, nodeId, direction) };
  return swapClips(project, firstClip.id, secondClip.id) ?? project;
}
