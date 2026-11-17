import { z } from "zod";
import type { RouteCatalogueEntry } from "../catalogues/routes/route-catalogue";
import { TYPE_CHARACTERS_PER_SECOND } from "../recording/action-schedule";
import { type Action, actionSchema } from "../storyboard/storyboard-schema";

export const MAX_SCRIPT_ACTIONS = 20;

/** What the exploring agent submits: timed actions on stable CSS selectors, saved as the clip's `source.actions`. */
export const recordingScriptSchema = z.object({
  actions: z.array(actionSchema).min(1).max(MAX_SCRIPT_ACTIONS),
});

export type RecordingScript = z.infer<typeof recordingScriptSchema>;

const KEY = /^(?:[A-Z][A-Za-z0-9]*|[a-z0-9])(?:\+(?:[A-Z][A-Za-z0-9]*|[a-z0-9]))*$/;

function targetOf(action: Action): string | null {
  return action.kind === "press" ? null : action.target;
}

/** When an action's input ends: typing runs at the recorder's typing speed. */
export function actionEnd(action: Action): number {
  return action.kind === "type"
    ? action.at + [...action.text].length / TYPE_CHARACTERS_PER_SECOND
    : action.at;
}

/** Problems the recorder would hit, or that would read badly on screen; empty when the script is usable. */
export function scriptErrors(script: RecordingScript, { duration }: { duration: number }): string[] {
  const errors: string[] = [];
  script.actions.forEach((action, index) => {
    const label = `Action ${index} (${action.kind})`;
    const previous = script.actions[index - 1];
    if (previous && action.at < actionEnd(previous) - 1e-6) {
      errors.push(
        `${label} at ${action.at} s starts before action ${index - 1} finishes at ${actionEnd(previous).toFixed(2)} s`
      );
    }
    if (actionEnd(action) > duration + 1e-6) {
      errors.push(`${label} ends at ${actionEnd(action).toFixed(2)} s, after the ${duration} s clip`);
    }
    const target = targetOf(action);
    if (target?.startsWith("@")) errors.push(`${label} uses the snapshot ref ${target}; use a CSS selector`);
    if (action.kind === "type" && action.text.trim() === "") errors.push(`${label} has no text`);
    if (action.kind === "press" && !KEY.test(action.key)) {
      errors.push(`${label} key "${action.key}" isn't a key name like Enter or Shift+Enter`);
    }
  });
  return errors;
}

/** The catalogue target a selector is, so progress can say what the agent found. */
export function catalogueTargetName(entry: RouteCatalogueEntry, selector: string): string | null {
  return entry.targets.find((target) => target.selector === selector)?.name ?? null;
}
