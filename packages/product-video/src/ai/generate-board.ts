import { type RouteCatalogueEntry, routeEntryFor } from "../catalogues/routes/route-catalogue";
import { AgentReplyError } from "../recording/agent-replies";
import type { RecordClipResult } from "../recording/record-clip";
import type { RecordingProgress } from "../recording/recording-events";
import { applyGeneratedClips } from "../storyboard/board-generation";
import { boardOrder } from "../storyboard/board-order";
import type { Board, BoardNode } from "../storyboard/board-schema";
import type { Action, Clip, Project } from "../storyboard/storyboard-schema";
import type { GenerationEvent } from "./generation-events";
import {
  NodeGenerationError,
  recordingClipForNode,
  textClipForNode,
  textEffectFor,
  writeTextWords,
} from "./node-clips";
import type { PreviousScene } from "./recording-explorer-prompt";
import type { RecordingScript } from "./recording-script";
import type { SubmitLoopUsage } from "./submit-tool-loop";

type NodeOf<Kind extends BoardNode["kind"]> = Extract<BoardNode, { kind: Kind }>;

export type GenerateBoardDeps = {
  explore: (input: {
    node: NodeOf<"recording">;
    entry: RouteCatalogueEntry;
    baseUrl: string;
    previous: PreviousScene | null;
    /** The board's project-wide direction; it applies to every scene. */
    brief: string;
    rehearse: (actions: Action[]) => Promise<string[]>;
    onProgress: (message: string) => void;
  }) => Promise<{ script: RecordingScript; usage?: SubmitLoopUsage }>;
  /** Plays a clip in the recorder without capturing; throws what recording it would. */
  rehearse: (input: { project: Project; clipId: string }) => Promise<void>;
  record: (input: {
    project: Project;
    clipId: string;
    onProgress: (progress: RecordingProgress) => void;
  }) => Promise<Pick<RecordClipResult, "directory">>;
  pickEffect?: (node: NodeOf<"text">) => Promise<string>;
  writeWords?: (node: NodeOf<"text">, brief: string) => Promise<string>;
  mediaClip?: (node: NodeOf<"media">, clipId?: string) => Promise<Clip>;
};

const PHASE_MESSAGES: Record<string, string> = {
  login: "Signing in",
  load: "Loading the page",
  preroll: "Letting the page settle",
  replay: "Replaying the previous scene",
  capture: "Capturing frames",
  proxy: "Making preview frames",
};

const nodeClips = (project: Project, nodeId: string) =>
  project.videoTracks.flatMap((track) => track.clips.filter((clip) => clip.storyboardNodeId === nodeId));

/**
 * Turns board nodes into clips in story order: text and media directly, recordings by exploring the route and
 * recording the script. Later nodes see earlier ones' new clips, so "start from previous" continues this run's take.
 */
export async function generateBoard({
  project,
  board,
  nodeIds,
  emit,
  deps,
}: {
  project: Project;
  board: Board;
  nodeIds?: readonly string[];
  emit: (event: GenerationEvent) => void;
  deps: GenerateBoardDeps;
}): Promise<void> {
  const order = boardOrder(board);
  const targets = order.filter((node) => !nodeIds || nodeIds.includes(node.id));
  for (const node of targets) emit({ nodeId: node.id, status: "queued" });

  let working: Project = { ...project, storyboard: board };
  const regenerated = new Set<string>();
  for (const node of targets) {
    const existingId = nodeClips(working, node.id)[0]?.id;
    try {
      let clips: Clip[];
      if (node.kind === "text") {
        const words = node.words.trim()
          ? node.words
          : await (deps.writeWords ?? writeTextWords)(node, board.brief);
        const written = { ...node, words };
        const effect = await textEffectFor(written, deps.pickEffect);
        clips = [textClipForNode(written, effect, existingId)];
      } else if (node.kind === "media") {
        if (!deps.mediaClip) throw new NodeGenerationError("Media isn't available here");
        clips = [await deps.mediaClip(node, existingId)];
      } else {
        clips = [await generateRecording({ node, order, working, existingId, emit, deps })];
      }
      working = applyGeneratedClips(working, node.id, clips, board);
      for (const clip of clips) if (clip.source.kind === "recording") regenerated.add(clip.id);
      emit({ nodeId: node.id, status: "done", clips });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit({ nodeId: node.id, status: "failed", message });
    }
  }
  await rerecordFollowers({ order, targets, working, regenerated, emit, deps });
  emit({ done: true });
}

const recordingProgress =
  (nodeId: string, emit: (event: GenerationEvent) => void) => (progress: RecordingProgress) => {
    if (progress.type === "phase") {
      emit({ nodeId, status: "recording", message: PHASE_MESSAGES[progress.phase] ?? progress.phase });
    } else {
      emit({ nodeId, status: "recording", progress: progress.frame / progress.frameCount });
    }
  };

/**
 * Records again, with their own scripts, the board's recordings that continue a regenerated one: the replay
 * they start from changed, so their takes no longer match.
 */
async function rerecordFollowers({
  order,
  targets,
  working,
  regenerated,
  emit,
  deps,
}: {
  order: BoardNode[];
  targets: BoardNode[];
  working: Project;
  regenerated: Set<string>;
  emit: (event: GenerationEvent) => void;
  deps: GenerateBoardDeps;
}): Promise<void> {
  const changed = new Set(regenerated);
  for (const node of order) {
    if (node.kind !== "recording" || targets.includes(node)) continue;
    const clip = nodeClips(working, node.id).find((candidate) => candidate.source.kind === "recording");
    const continues = clip?.source.kind === "recording" ? clip.source.startFrom?.clipId : undefined;
    if (!clip || !continues || !changed.has(continues)) continue;
    changed.add(clip.id);
    emit({
      nodeId: node.id,
      status: "recording",
      message: "Recording again after the scene before it changed",
    });
    try {
      await deps.record({ project: working, clipId: clip.id, onProgress: recordingProgress(node.id, emit) });
      emit({ nodeId: node.id, status: "done" });
    } catch (error) {
      emit({
        nodeId: node.id,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function generateRecording({
  node,
  order,
  working,
  existingId,
  emit,
  deps,
}: {
  node: NodeOf<"recording">;
  order: BoardNode[];
  working: Project;
  existingId: string | undefined;
  emit: (event: GenerationEvent) => void;
  deps: GenerateBoardDeps;
}): Promise<Clip> {
  const app = working.settings.app?.kind ?? "cal";
  if (app === "none")
    throw new NodeGenerationError("This project uses your own files, so it has no app to record");
  if (app === "custom")
    throw new NodeGenerationError("Recording apps other than Cal.com isn’t supported yet");
  const entry = routeEntryFor(node.route);
  if (!entry) throw new NodeGenerationError(`${node.route} isn't a path in the app`);

  let previous: PreviousScene | null = null;
  let startFrom: string | undefined;
  if (node.startFrom === "previous") {
    const before = order.slice(0, order.indexOf(node)).filter((candidate) => candidate.kind === "recording");
    const previousNode = before.at(-1);
    const previousClip = previousNode
      ? nodeClips(working, previousNode.id).find((clip) => clip.source.kind === "recording")
      : undefined;
    if (!previousNode || !previousClip || previousClip.source.kind !== "recording") {
      throw new NodeGenerationError("Generate the recording scene before this one first");
    }
    previous = { title: previousNode.title, notes: previousNode.notes, actions: previousClip.source.actions };
    startFrom = previousClip.id;
  }

  emit({ nodeId: node.id, status: "exploring", message: `Exploring ${node.route}` });
  const clipId = existingId ?? crypto.randomUUID();
  const clipFor = (actions: Action[]) => recordingClipForNode(node, { actions, clipId, startFrom });
  const exploreStarted = Date.now();
  const { script, usage } = await deps.explore({
    node,
    entry,
    baseUrl: working.settings.baseUrl,
    previous,
    brief: working.storyboard?.brief ?? "",
    rehearse: async (actions) => {
      try {
        await deps.rehearse({ project: applyGeneratedClips(working, node.id, [clipFor(actions)]), clipId });
        return [];
      } catch (error) {
        if (error instanceof AgentReplyError) throw error;
        return [error instanceof Error ? error.message : String(error)];
      }
    },
    onProgress: (message) => emit({ nodeId: node.id, status: "exploring", message }),
  });
  const seconds = Math.round((Date.now() - exploreStarted) / 1000);
  const tokens = usage
    ? ` · ${usage.steps} steps, ${usage.inputTokens} in / ${usage.outputTokens} out tokens`
    : "";
  emit({ nodeId: node.id, status: "exploring", message: `Scripted in ${seconds} s${tokens}` });
  const clip = clipFor(script.actions);

  emit({ nodeId: node.id, status: "recording", message: "Recording", progress: 0 });
  await deps.record({
    project: applyGeneratedClips(working, node.id, [clip]),
    clipId: clip.id,
    onProgress: recordingProgress(node.id, emit),
  });
  return clip;
}
