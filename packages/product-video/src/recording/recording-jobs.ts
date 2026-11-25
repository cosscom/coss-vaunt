import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { engineCliCommand } from "../engine-cli";
import { parseRecordingEvent, type RecordingEvent } from "./recording-events";

type Job = { events: RecordingEvent[]; listeners: Set<(event: RecordingEvent) => void>; finished: boolean };

/** Lives on globalThis so a dev-server module reload doesn't lose track of a running recording. */
const registry = globalThis as { __studioRecordingJobs?: Map<string, Job> };
registry.__studioRecordingJobs ??= new Map();
const jobs: Map<string, Job> = registry.__studioRecordingJobs;

export function recordingJobKey({
  projectId,
  clipId,
  theme,
}: {
  projectId: string;
  clipId: string;
  theme: string;
}): string {
  return `${projectId}/${clipId}/${theme}`;
}

/** Starts the record CLI as a child process unless the same recording is already running. */
export function startRecordingJob({
  repoRoot,
  studioRoot,
  projectId,
  clipId,
  theme,
  force,
}: {
  repoRoot: string;
  studioRoot: string;
  projectId: string;
  clipId: string;
  theme: "light" | "dark";
  force: boolean;
}): { started: boolean } {
  const key = recordingJobKey({ projectId, clipId, theme });
  if (jobs.get(key)?.finished === false) return { started: false };

  const job: Job = { events: [], listeners: new Set(), finished: false };
  jobs.set(key, job);
  const emit = (event: RecordingEvent) => {
    if (job.finished) return;
    job.events.push(event);
    if (event.type === "done" || event.type === "error") job.finished = true;
    for (const listener of job.listeners) listener(event);
  };

  const args = [
    projectId,
    clipId,
    "--theme",
    theme,
    "--json",
    "--root",
    studioRoot,
    ...(force ? ["--force"] : []),
  ];
  const cli = engineCliCommand(repoRoot, "record");
  const child = spawn(cli.command, [...cli.args, ...args], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-2000);
  });
  createInterface({ input: child.stdout }).on("line", (line) => {
    const event = parseRecordingEvent(line);
    if (event) emit(event);
  });
  child.on("error", (error) => emit({ type: "error", message: error.message }));
  child.on("close", (code) => {
    emit({
      type: "error",
      message: `The recorder exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`,
    });
  });
  return { started: true };
}

/** Replays a job's events so far, then follows it; null when no job exists for the key. */
export function followRecordingJob(
  key: string,
  listener: (event: RecordingEvent) => void
): (() => void) | null {
  const job = jobs.get(key);
  if (!job) return null;
  for (const event of job.events) listener(event);
  if (job.finished) return () => undefined;
  job.listeners.add(listener);
  return () => job.listeners.delete(listener);
}

export function isRecordingJobRunning(key: string): boolean {
  return jobs.get(key)?.finished === false;
}
