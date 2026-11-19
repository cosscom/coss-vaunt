type AppliedStorage = Pick<Storage, "getItem" | "setItem">;

const storageKey = (projectId: string) => `coss-motion:generation-applied:${projectId}`;

/**
 * The scenes of `jobId` whose clips this browser already put on the timeline. Only the project's latest job is
 * kept: an editor opened mid-generation replays the job's events, and must not undo edits made since.
 */
export function appliedScenes(storage: AppliedStorage, projectId: string, jobId: string): Set<string> {
  const saved = JSON.parse(storage.getItem(storageKey(projectId)) ?? "null") as {
    jobId: string;
    nodeIds: string[];
  } | null;
  return new Set(saved?.jobId === jobId ? saved.nodeIds : []);
}

export function saveAppliedScenes(
  storage: AppliedStorage,
  projectId: string,
  jobId: string,
  nodeIds: ReadonlySet<string>
): void {
  storage.setItem(storageKey(projectId), JSON.stringify({ jobId, nodeIds: [...nodeIds] }));
}
