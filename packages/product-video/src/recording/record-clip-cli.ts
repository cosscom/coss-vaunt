import path from "node:path";
import { parseArgs } from "node:util";
import { ZodError } from "zod";
import { createFileProjectStore } from "../project-store/file-project-store";
import { recordClip } from "./record-clip";
import type { RecordingEvent } from "./recording-events";

function errorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  }
  return error instanceof Error ? error.message : String(error);
}

const DEFAULT_STUDIO_ROOT = path.resolve(import.meta.dirname, "../../../../.studio");
const USAGE =
  "Usage: yarn workspace @coss/vaunt-engine record <projectId> <clipId> [--theme light|dark] [--force] [--json]";

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      theme: { type: "string" },
      force: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      root: { type: "string", default: DEFAULT_STUDIO_ROOT },
    },
  });
  const emit = (event: RecordingEvent) => {
    if (values.json) {
      process.stdout.write(`${JSON.stringify(event)}\n`);
      return;
    }
    if (event.type === "phase") console.log(`${event.phase}…`);
    if (event.type === "frame" && (event.frame % 10 === 0 || event.frame === event.frameCount)) {
      console.log(
        `frame ${event.frame}/${event.frameCount} · ${event.elapsedSeconds.toFixed(0)} s · eta ${event.etaSeconds.toFixed(0)} s`
      );
    }
    if (event.type === "done") {
      console.log(
        `${event.reused ? "Already recorded" : "Recorded"} ${event.frameCount} frames · ${event.captureHash}`
      );
      if (event.secondsPerFrame !== null) console.log(`${event.secondsPerFrame.toFixed(2)} s/frame`);
      console.log(event.directory);
    }
    if (event.type === "error") console.error(event.message);
  };

  try {
    const [projectId, clipId] = positionals;
    if (!projectId || !clipId) throw new Error(USAGE);
    if (values.theme !== undefined && values.theme !== "light" && values.theme !== "dark")
      throw new Error(USAGE);
    const project = await createFileProjectStore(values.root).get(projectId);
    if (!project) throw new Error(`Project ${projectId} not found in ${values.root}`);
    const result = await recordClip({
      project,
      clipId,
      theme: values.theme,
      projectDir: path.join(values.root, project.id),
      force: values.force,
      onProgress: emit,
    });
    emit({
      type: "done",
      captureHash: result.manifest.captureHash,
      frameCount: result.manifest.frameCount,
      directory: result.directory,
      reused: result.reused,
      secondsPerFrame: result.secondsPerFrame,
    });
  } catch (error) {
    emit({ type: "error", message: errorMessage(error) });
    process.exitCode = 1;
  }
}

void main();
