import { spawn } from "node:child_process";
import path from "node:path";
import { createInterface } from "node:readline";
import {
  type GenerateBoardRequest,
  type GenerationEvent,
  isGenerationEnd,
  parseGenerationEvent,
} from "./generation-events";

type Job = {
  projectId: string;
  events: GenerationEvent[];
  listeners: Set<(event: GenerationEvent) => void>;
  finished: boolean;
};

/** Lives on globalThis so a dev-server module reload doesn't lose track of a running generation. */
const registry = globalThis as { __studioGenerationJobs?: Map<string, Job> };
registry.__studioGenerationJobs ??= new Map();
const jobs: Map<string, Job> = registry.__studioGenerationJobs;

/** Starts the generate CLI as a child process, one per project at a time; null while one is running. */
export function startGenerationJob({
  repoRoot,
  studioRoot,
  projectId,
  request,
}: {
  repoRoot: string;
  studioRoot: string;
  projectId: string;
  request: GenerateBoardRequest;
}): { jobId: string } | null {
  for (const job of jobs.values()) if (job.projectId === projectId && !job.finished) return null;

  const jobId = crypto.randomUUID();
  const job: Job = { projectId, events: [], listeners: new Set(), finished: false };
  jobs.set(jobId, job);
  const emit = (event: GenerationEvent) => {
    if (job.finished) return;
    job.events.push(event);
    if (isGenerationEnd(event)) job.finished = true;
    for (const listener of job.listeners) listener(event);
  };

  const child = spawn(
    path.join(repoRoot, "node_modules/.bin/tsx"),
    [
      path.join(repoRoot, "packages/product-video/src/ai/generate-board-cli.ts"),
      projectId,
      "--root",
      studioRoot,
    ],
    { cwd: repoRoot, stdio: ["pipe", "pipe", "pipe"] }
  );
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-2000);
  });
  createInterface({ input: child.stdout }).on("line", (line) => {
    const event = parseGenerationEvent(line);
    if (event) emit(event);
  });
  child.on("error", (error) => emit({ done: true, error: error.message }));
  child.on("close", (code) => {
    emit({
      done: true,
      error: `The generator exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`,
    });
  });
  child.stdin.end(JSON.stringify(request));
  return { jobId };
}

/** Replays a job's events so far, then follows it; null when the project has no such job. */
export function followGenerationJob(
  { projectId, jobId }: { projectId: string; jobId: string },
  listener: (event: GenerationEvent) => void
): (() => void) | null {
  const job = jobs.get(jobId);
  if (!job || job.projectId !== projectId) return null;
  for (const event of job.events) listener(event);
  if (job.finished) return () => undefined;
  job.listeners.add(listener);
  return () => job.listeners.delete(listener);
}
