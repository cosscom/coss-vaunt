import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { createInterface } from "node:readline";
import { type ExportEvent, parseExportEvent } from "./export-events";
import type { ExportSettings } from "./export-settings";

type Job = {
  events: ExportEvent[];
  listeners: Set<(event: ExportEvent) => void>;
  finished: boolean;
  child: ChildProcess;
};

/** Lives on globalThis so a dev-server module reload doesn't lose track of a running export. */
const registry = globalThis as { __studioExportJobs?: Map<string, Job> };
registry.__studioExportJobs ??= new Map();
const jobs: Map<string, Job> = registry.__studioExportJobs;

/** Starts the export CLI as a child process, one export per project at a time. */
export function startExportJob({
  repoRoot,
  studioRoot,
  studioUrl,
  projectId,
  settings,
  name,
}: {
  repoRoot: string;
  studioRoot: string;
  studioUrl: string;
  projectId: string;
  settings: ExportSettings;
  name: string;
}): { started: boolean } {
  if (jobs.get(projectId)?.finished === false) return { started: false };

  const args = [
    path.join(repoRoot, "packages/product-video/src/export/export-video-cli.ts"),
    projectId,
    "--format",
    settings.format,
    "--resolution",
    settings.resolution,
    "--fps",
    String(settings.fps),
    "--bitrate",
    String(settings.videoBitrateMbps),
    ...(settings.audio ? [] : ["--no-audio"]),
    "--name",
    name,
    "--studio",
    studioUrl,
    "--root",
    studioRoot,
    "--json",
  ];
  const child = spawn(path.join(repoRoot, "node_modules/.bin/tsx"), args, {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const job: Job = { events: [], listeners: new Set(), finished: false, child };
  jobs.set(projectId, job);
  const emit = (event: ExportEvent) => {
    if (job.finished) return;
    // Frame events arrive per frame; a late follower only needs the latest one.
    if (event.type === "frame" && job.events.at(-1)?.type === "frame") job.events.pop();
    job.events.push(event);
    if (event.type === "done" || event.type === "error") job.finished = true;
    for (const listener of job.listeners) listener(event);
  };

  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-2000);
  });
  if (child.stdout) {
    createInterface({ input: child.stdout }).on("line", (line) => {
      const event = parseExportEvent(line);
      if (event) emit(event);
    });
  }
  child.on("error", (error) => emit({ type: "error", message: error.message }));
  child.on("close", (code) => {
    emit({
      type: "error",
      message: `The exporter exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`,
    });
  });
  return { started: true };
}

/** Replays a job's events so far, then follows it; null when the project has no export. */
export function followExportJob(
  projectId: string,
  listener: (event: ExportEvent) => void
): (() => void) | null {
  const job = jobs.get(projectId);
  if (!job) return null;
  for (const event of job.events) listener(event);
  if (job.finished) return () => undefined;
  job.listeners.add(listener);
  return () => job.listeners.delete(listener);
}

/** Stops a running export; it removes its partial file on the way out. */
export function cancelExportJob(projectId: string): boolean {
  const job = jobs.get(projectId);
  if (!job || job.finished) return false;
  job.child.kill("SIGTERM");
  return true;
}
