import type { AppLogin } from "@calcom/product-video/project-store/project-store";
import { isAllowedRecordingHost } from "@calcom/product-video/recording/host-allowlist";
import type { ProjectSetup } from "@calcom/product-video/storyboard/storyboard-factories";
import type { AspectRatio } from "@calcom/product-video/storyboard/storyboard-schema";

export type AppChoice = "cal" | "custom" | "none";

/** Everything the new-project dialog collects, kept for every choice so switching back doesn't lose typing. */
export type NewProjectDraft = {
  name: string;
  aspectRatio: AspectRatio;
  app: AppChoice;
  calUrl: string;
  customUrl: string;
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
    app: "cal",
    calUrl: defaultAppUrl,
    customUrl: "",
    instructions: "",
    signIn: false,
    username: "",
    password: "",
  };
}

export function draftUrl(draft: NewProjectDraft): string {
  return draft.app === "custom" ? draft.customUrl.trim() : draft.calUrl.trim();
}

/** Whether an address field should say it's wrong: typed, and not an app on this machine. */
export function urlProblem(value: string): boolean {
  return value.trim() !== "" && !isAllowedRecordingHost(value.trim());
}

/** A name, and for a recorded app a local address; a custom app that signs in needs both its login fields. */
export function draftReady(draft: NewProjectDraft): boolean {
  if (!draft.name.trim()) return false;
  if (draft.app === "none") return true;
  if (!isAllowedRecordingHost(draftUrl(draft))) return false;
  return !(draft.app === "custom" && draft.signIn && (!draft.username.trim() || !draft.password));
}

/** What to create. Skipping keeps the default address so the project can still be pointed at an app later. */
export function draftInput(draft: NewProjectDraft, defaultAppUrl: string): NewProjectInput {
  const name = draft.name.trim();
  const { aspectRatio } = draft;
  if (draft.app === "none")
    return { name, setup: { aspectRatio, app: { kind: "none" }, baseUrl: defaultAppUrl } };
  if (draft.app === "cal")
    return { name, setup: { aspectRatio, app: { kind: "cal" }, baseUrl: draftUrl(draft) } };
  return {
    name,
    setup: {
      aspectRatio,
      app: { kind: "custom", instructions: draft.instructions.trim() },
      baseUrl: draftUrl(draft),
      ...(draft.signIn ? { login: { username: draft.username.trim(), password: draft.password } } : {}),
    },
  };
}
