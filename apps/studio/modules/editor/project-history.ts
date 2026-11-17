import type { Project } from "@calcom/product-video/storyboard/storyboard-schema";

export type ProjectHistory = {
  past: Project[];
  present: Project;
  future: Project[];
  /** Edits with the same group inside the window replace the last entry, so a slider drag undoes in one step. */
  group: string | null;
  groupedAt: number;
};

const MAX_ENTRIES = 200;
export const COALESCE_WINDOW_MS = 1000;

export function createHistory(project: Project): ProjectHistory {
  return { past: [], present: project, future: [], group: null, groupedAt: 0 };
}

export function pushHistory(
  history: ProjectHistory,
  next: Project,
  { group = null, now }: { group?: string | null; now: number }
): ProjectHistory {
  if (next === history.present) return history;
  const coalesce = group !== null && group === history.group && now - history.groupedAt < COALESCE_WINDOW_MS;
  return {
    past: coalesce ? history.past : [...history.past, history.present].slice(-MAX_ENTRIES),
    present: next,
    future: [],
    group,
    groupedAt: now,
  };
}

export function undo(history: ProjectHistory): ProjectHistory {
  const previous = history.past[history.past.length - 1];
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    group: null,
    groupedAt: 0,
  };
}

export function redo(history: ProjectHistory): ProjectHistory {
  const [next, ...future] = history.future;
  if (!next) return history;
  return { past: [...history.past, history.present], present: next, future, group: null, groupedAt: 0 };
}
