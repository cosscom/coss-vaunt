import path from "node:path";
import { parseArgs } from "node:util";
import { createFileProjectStore } from "../project-store/file-project-store";
import type { ExportEvent } from "./export-events";
import { EXPORT_RESOLUTIONS, type ExportSettings, exportFileName } from "./export-settings";
import { exportVideo } from "./export-video";

const DEFAULT_STUDIO_ROOT = path.resolve(import.meta.dirname, "../../../../.studio");
const USAGE =
  "Usage: yarn workspace @calcom/product-video export <projectId> [--format mp4|prores] [--resolution 1080p] [--fps 30] [--bitrate 8] [--no-audio] [--name file.mp4] [--studio http://localhost:3102] [--json]";

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      format: { type: "string", default: "mp4" },
      resolution: { type: "string", default: "1080p" },
      fps: { type: "string" },
      bitrate: { type: "string", default: "8" },
      "no-audio": { type: "boolean", default: false },
      name: { type: "string" },
      studio: { type: "string", default: "http://localhost:3102" },
      json: { type: "boolean", default: false },
      root: { type: "string", default: DEFAULT_STUDIO_ROOT },
    },
  });
  const emit = (event: ExportEvent) => {
    if (values.json) {
      process.stdout.write(`${JSON.stringify(event)}\n`);
      return;
    }
    if (event.type === "phase") console.log(`${event.phase}…`);
    if (event.type === "frame" && (event.frame % 30 === 0 || event.frame === event.frameCount)) {
      console.log(`frame ${event.frame}/${event.frameCount} · eta ${event.etaSeconds.toFixed(0)} s`);
    }
    if (event.type === "done")
      console.log(`${event.file} · ${(event.bytes / 1e6).toFixed(1)} MB · ${event.seconds.toFixed(0)} s`);
    if (event.type === "error") console.error(event.message);
  };

  const controller = new AbortController();
  process.on("SIGTERM", () => controller.abort());
  try {
    const [projectId] = positionals;
    const resolution = EXPORT_RESOLUTIONS.find((candidate) => candidate === values.resolution);
    if (!projectId || !resolution || (values.format !== "mp4" && values.format !== "prores"))
      throw new Error(USAGE);
    const project = await createFileProjectStore(values.root).get(projectId);
    if (!project) throw new Error(`Project ${projectId} not found in ${values.root}`);
    const settings: ExportSettings = {
      format: values.format,
      resolution,
      fps: values.fps ? Number(values.fps) : project.settings.fps,
      videoBitrateMbps: Number(values.bitrate),
      audio: !values["no-audio"],
    };
    const result = await exportVideo({
      project,
      projectDir: path.join(values.root, project.id),
      studioUrl: values.studio,
      settings,
      name: values.name ?? exportFileName(project, settings, new Date()),
      onEvent: emit,
      signal: controller.signal,
    });
    emit({ type: "done", ...result });
  } catch (error) {
    emit({ type: "error", message: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  }
}

void main();
