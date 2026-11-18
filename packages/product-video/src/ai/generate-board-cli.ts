import path from "node:path";
import { text } from "node:stream/consumers";
import { parseArgs } from "node:util";
import { createFileProjectStore } from "../project-store/file-project-store";
import { recordClip, rehearseClip } from "../recording/record-clip";
import { generateBoard } from "./generate-board";
import { type GenerationEvent, generateBoardRequestSchema } from "./generation-events";
import { mediaClipForNode } from "./node-clips";
import { exploreRecording } from "./recording-explorer";
import { loadAiKeys } from "./studio-model";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const USAGE = "Usage: tsx src/ai/generate-board-cli.ts <projectId> [--root <studio root>] < request.json";

/** Generates a board's clips; reads `{ board, nodeIds? }` on stdin and prints one JSON event per line. */
async function main(): Promise<void> {
  const emit = (event: GenerationEvent) => process.stdout.write(`${JSON.stringify(event)}\n`);
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: { root: { type: "string", default: path.join(REPO_ROOT, ".studio") } },
    });
    const [projectId] = positionals;
    if (!projectId) throw new Error(USAGE);
    const request = generateBoardRequestSchema.parse(JSON.parse(await text(process.stdin)));
    const project = await createFileProjectStore(values.root).get(projectId);
    if (!project) throw new Error(`Project ${projectId} not found in ${values.root}`);
    const projectDir = path.join(values.root, project.id);
    await loadAiKeys(REPO_ROOT);

    await generateBoard({
      project,
      board: request.board,
      nodeIds: request.nodeIds,
      emit,
      deps: {
        explore: exploreRecording,
        rehearse: ({ project: withClip, clipId }) => rehearseClip({ project: withClip, clipId, projectDir }),
        record: ({ project: withClip, clipId, onProgress }) =>
          recordClip({ project: withClip, clipId, projectDir, onProgress }),
        mediaClip: (node, clipId) => mediaClipForNode(node, projectDir, clipId),
      },
    });
  } catch (error) {
    emit({ done: true, error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  }
}

void main();
