import type { AppLogin } from "@calcom/product-video/project-store/project-store";
import { isAllowedRecordingHost } from "@calcom/product-video/recording/host-allowlist";
import type { ProjectSetup } from "@calcom/product-video/storyboard/storyboard-factories";
import type { AspectRatio } from "@calcom/product-video/storyboard/storyboard-schema";

export type AppChoice = "web" | "none";

/** Everything the new-project dialog collects. */
export type NewProjectDraft = {
  name: string;
  aspectRatio: AspectRatio;
  app: AppChoice;
  url: string;
  instructions: string;
  signIn: boolean;
  username: string;
  password: string;
};

export type NewProjectInput = { name: string; setup: ProjectSetup & { login?: AppLogin } };

export function initialDraft(defaultAppUrl: string): NewProjectDraft {
  return {
    name: "",
    aspectRatio: "16:9",
    app: "web",
    url: defaultAppUrl,
    instructions: "",
    signIn: false,
    username: "",
    password: "",
  };
}

/** Whether an address field should say it's wrong: typed, and not an app on this machine. */
export function urlProblem(value: string): boolean {
  return value.trim() !== "" && !isAllowedRecordingHost(value.trim());
}

/** A name, and for a recorded app a local address; an app that signs in needs both its login fields. */
export function draftReady(draft: NewProjectDraft): boolean {
  if (!draft.name.trim()) return false;
  if (draft.app === "none") return true;
  if (!isAllowedRecordingHost(draft.url.trim())) return false;
  return !(draft.signIn && (!draft.username.trim() || !draft.password));
}

/**
 * What to create. Skipping keeps the default address so the project can still be pointed at an app later. A recorded
 * app gets the author's timezone, which its test account most likely uses too.
 */
export function draftInput(draft: NewProjectDraft, defaultAppUrl: string, timezone: string): NewProjectInput {
  const name = draft.name.trim();
  const { aspectRatio } = draft;
  if (draft.app === "none")
    return { name, setup: { aspectRatio, app: { kind: "none" }, baseUrl: defaultAppUrl } };
  return {
    name,
    setup: {
      aspectRatio,
      app: { kind: "web", instructions: draft.instructions.trim() },
      baseUrl: draft.url.trim(),
      timezone,
      ...(draft.signIn ? { login: { username: draft.username.trim(), password: draft.password } } : {}),
    },
  };
}
