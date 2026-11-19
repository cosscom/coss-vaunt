import type { Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { saveProjectAction } from "@/modules/projects/project-actions";

let queue: Promise<unknown> = Promise.resolve();

/**
 * Saves one at a time, in call order, so an earlier save can't land after a later one. Recording and generation
 * read the project from disk, so they save through here first.
 */
export function saveProjectInOrder(project: Project): Promise<void> {
  const save = queue.then(() => saveProjectAction(project));
  queue = save.catch(() => undefined);
  return save.then(() => undefined);
}
