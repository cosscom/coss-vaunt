import { boardOrder, incomingEdge } from "./board-order";
import type { Board } from "./board-schema";
import { MIN_CLIP_SECONDS, spansAreValid } from "./storyboard-edits";
import { createVideoTrack } from "./storyboard-factories";
import { type Clip, MAX_TRANSITION_SECONDS, type Project } from "./storyboard-schema";
import { clipEnd } from "./track-resolution";

const EPSILON = 1e-6;
type Placement = { trackIndex: number; start: number; previous: Clip | null; later: Clip[] };

const visibleTracks = (project: Project) =>
  project.videoTracks.flatMap((track, trackIndex) => (track.hidden ? [] : [{ track, trackIndex }]));

/**
 * Where a node's clips go: over its old clips on a visible track; else on the visible track that holds the
 * board's other clips, after the last earlier node's; else on the first visible track free for `length`
 * seconds from the start, or on a new track at the end of the list.
 */
function placementFor(project: Project, board: Board, nodeId: string, length: number): Placement {
  for (const { track, trackIndex } of visibleTracks(project)) {
    const own = track.clips
      .filter((clip) => clip.storyboardNodeId === nodeId)
      .sort((a, b) => a.start - b.start);
    if (own.length === 0) continue;
    const others = track.clips.filter((clip) => clip.storyboardNodeId !== nodeId);
    const previous =
      others
        .filter((clip) => clip.start < own[0].start - EPSILON)
        .sort((a, b) => clipEnd(b) - clipEnd(a))[0] ?? null;
    return {
      trackIndex,
      start: previous ? Math.max(own[0].start, clipEnd(previous)) : own[0].start,
      previous,
      later: others.filter((clip) => clip.start >= own[0].start - EPSILON),
    };
  }

  const boardNodes = new Set(board.nodes.map((node) => node.id).filter((id) => id !== nodeId));
  const boardTrack = visibleTracks(project).find(({ track }) =>
    track.clips.some((clip) => clip.storyboardNodeId !== undefined && boardNodes.has(clip.storyboardNodeId))
  );
  if (boardTrack) {
    const clips = boardTrack.track.clips.filter((clip) => clip.storyboardNodeId !== nodeId);
    const order = boardOrder(board);
    const earlier = order.slice(
      0,
      Math.max(
        0,
        order.findIndex((node) => node.id === nodeId)
      )
    );
    for (const node of [...earlier].reverse()) {
      const own = clips.filter((clip) => clip.storyboardNodeId === node.id);
      if (own.length === 0) continue;
      const previous = own.reduce((last, clip) => (clipEnd(clip) > clipEnd(last) ? clip : last));
      return {
        trackIndex: boardTrack.trackIndex,
        start: clipEnd(previous),
        previous,
        later: clips.filter((clip) => clip !== previous && clip.start > previous.start + EPSILON),
      };
    }
    return { trackIndex: boardTrack.trackIndex, start: 0, previous: null, later: clips };
  }

  const free = visibleTracks(project).find(({ track }) =>
    track.clips.every((clip) => clip.storyboardNodeId === nodeId || clip.start >= length - EPSILON)
  );
  if (free) {
    const later = free.track.clips.filter((clip) => clip.storyboardNodeId !== nodeId);
    return { trackIndex: free.trackIndex, start: 0, previous: null, later };
  }
  return { trackIndex: project.videoTracks.length, start: 0, previous: null, later: [] };
}

/** The track with `clips` placed and later clips moved right; null when that breaks the overlap rules. */
function layOut(
  trackClips: Clip[],
  placement: Placement,
  clips: Clip[],
  nodeId: string,
  overlap: number,
  transition: Clip["transitionIn"] | undefined
): Clip[] | null {
  let cursor = placement.start - overlap;
  const placed = clips.map((clip, index) => {
    const start = cursor;
    cursor += clip.duration;
    const transitionIn = index === 0 && transition && overlap > 0 ? transition : clip.transitionIn;
    return { ...clip, start, transitionIn, storyboardNodeId: nodeId };
  });
  const later = [...placement.later].sort((a, b) => a.start - b.start);
  const base = [
    ...trackClips.filter((clip) => clip.storyboardNodeId !== nodeId && !later.includes(clip)),
    ...placed,
  ];
  const shifted = (shift: number) => later.map((clip) => ({ ...clip, start: clip.start + shift }));
  const firstLater = later[0];
  const candidates = firstLater
    ? [
        // Keep the overlap the next clip had with the clip it followed, or drop it when that no longer fits.
        Math.max(
          0,
          cursor -
            (placement.previous ? Math.max(0, clipEnd(placement.previous) - firstLater.start) : 0) -
            firstLater.start
        ),
        Math.max(0, cursor - firstLater.start),
      ]
    : [0];
  for (const shift of candidates) {
    const result = [...base, ...shifted(shift)].sort((a, b) => a.start - b.start);
    if (spansAreValid(result)) return result;
  }
  return null;
}

/**
 * Puts a node's generated clips on the timeline, keeping a board's clips on one visible track in story order:
 * over the node's existing clips, otherwise after the clips of the node before it. The incoming edge's transition becomes an overlap with the clip before, and
 * later clips on the track move right by as much as they need to stay valid.
 */
export function applyGeneratedClips(
  project: Project,
  nodeId: string,
  clips: Clip[],
  board: Board | undefined = project.storyboard
): Project {
  if (clips.length === 0) return project;
  const length = clips.reduce((sum, clip) => sum + clip.duration, 0);
  const placement = placementFor(project, board ?? { nodes: [], edges: [], brief: "" }, nodeId, length);
  const videoTracks =
    placement.trackIndex === project.videoTracks.length
      ? [...project.videoTracks, createVideoTrack(`Video ${project.videoTracks.length + 1}`)]
      : project.videoTracks;
  const edge = board ? incomingEdge(board, nodeId) : null;
  const { previous } = placement;
  const touching = previous !== null && clipEnd(previous) > placement.start - EPSILON;
  const wanted = edge && edge.transition !== "cut" && touching ? edge.transitionSeconds : 0;
  const overlap = previous
    ? Math.max(
        0,
        Math.min(
          wanted,
          MAX_TRANSITION_SECONDS,
          Math.min(previous.duration, clips[0].duration) - MIN_CLIP_SECONDS
        )
      )
    : 0;
  const track = videoTracks[placement.trackIndex];
  const trackClips =
    layOut(track.clips, placement, clips, nodeId, overlap, edge?.transition) ??
    layOut(track.clips, placement, clips, nodeId, 0, undefined) ??
    track.clips;

  return {
    ...project,
    videoTracks: videoTracks.map((current, index) =>
      index === placement.trackIndex
        ? { ...current, clips: trackClips }
        : { ...current, clips: current.clips.filter((clip) => clip.storyboardNodeId !== nodeId) }
    ),
  };
}
