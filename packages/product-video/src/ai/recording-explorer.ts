import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { tool } from "ai";
import { chromium } from "playwright";
import { z } from "zod";
import type { AppLogin } from "../project-store/project-store";
import { signIn } from "../recording/app-sign-in";
import { RECORDING_VIEWPORT } from "../recording/capture-hash";
import { pageRuntimeScript } from "../recording/record-clip";
import type { BoardNode } from "../storyboard/board-schema";
import type { Action } from "../storyboard/storyboard-schema";
import { AgentBrowserSession } from "./agent-browser-cli";
import {
  type PreviousScene,
  recordingExplorerSystemPrompt,
  recordingExplorerUserPrompt,
  SUBMIT_SCRIPT_TOOL,
} from "./recording-explorer-prompt";
import { actionEnd, type RecordingScript, recordingScriptSchema, scriptErrors } from "./recording-script";
import type { StudioModel } from "./studio-model";
import { runUntilSubmitted, type SubmitLoopUsage } from "./submit-tool-loop";

const MAX_STEPS = 24;
const MAX_ATTEMPTS = 3;
const MAX_REPLAY_PAUSE_MS = 4_000;
const DESCRIBED_ATTRIBUTES = [
  "data-testid",
  "id",
  "name",
  "aria-label",
  "placeholder",
  "role",
  "type",
] as const;

type RecordingNode = Extract<BoardNode, { kind: "recording" }>;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const quote = (value: string) => `"${value.replace(/["\\]/g, "\\$&")}"`;

function candidateSelectors(attributes: Record<string, string | null>): string[] {
  const candidates: string[] = [];
  const testId = attributes["data-testid"];
  if (testId) candidates.push(`[data-testid=${quote(testId)}]`);
  if (attributes.id && /^[A-Za-z][\w-]*$/.test(attributes.id)) candidates.push(`#${attributes.id}`);
  for (const name of ["name", "aria-label", "placeholder"] as const) {
    const value = attributes[name];
    if (value) candidates.push(`[${name}=${quote(value)}]`);
  }
  return candidates;
}

/** Plays the previous scene's actions in agent-browser at roughly their real timing, so exploring starts after it. */
async function playActions(browser: AgentBrowserSession, actions: readonly Action[]): Promise<void> {
  let clock = 0;
  for (const action of actions) {
    const pause = Math.min(MAX_REPLAY_PAUSE_MS, Math.max(0, (action.at - clock) * 1000));
    if (pause > 0) await browser.wait(pause);
    if (action.kind === "move") await browser.hover(action.target).catch(() => undefined);
    if (action.kind === "click") await browser.click(action.target).catch(() => undefined);
    if (action.kind === "type") await browser.type(action.target, action.text).catch(() => undefined);
    if (action.kind === "press") await browser.press(action.key).catch(() => undefined);
    clock = Math.max(clock, actionEnd(action));
  }
}

/**
 * Explores a recording node's route with agent-browser and returns a checked recording script. The agent signs in
 * with the project's test login, if it has one, and never leaves the app.
 */
export async function exploreRecording({
  node,
  login,
  appNotes = "",
  timezone,
  baseUrl,
  previous,
  brief = "",
  rehearse,
  onProgress,
  model,
}: {
  node: RecordingNode;
  login: AppLogin | null;
  appNotes?: string;
  /** The project's recording timezone, so exploring sees what the recording will. */
  timezone: string;
  baseUrl: string;
  previous: PreviousScene | null;
  brief?: string;
  /** Plays the script in the recorder without capturing; the errors the recording would hit. */
  rehearse: (actions: Action[]) => Promise<string[]>;
  onProgress: (message: string) => void;
  model?: StudioModel;
}): Promise<{ script: RecordingScript; usage: SubmitLoopUsage }> {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "studio-explore-"));
  const initScriptPath = path.join(scratch, "runtime.js");
  let statePath: string | null = null;
  if (login) {
    onProgress(`Signing in as ${login.username}`);
    const playwright = await chromium.launch();
    try {
      const state = await signIn({ browser: playwright, baseUrl, startPath: node.route, login });
      statePath = path.join(scratch, "state.json");
      await writeFile(statePath, JSON.stringify(state), { mode: 0o600 });
    } finally {
      await playwright.close();
    }
  }
  await writeFile(initScriptPath, pageRuntimeScript());

  const browser = new AgentBrowserSession({
    session: `studio-${crypto.randomUUID().slice(0, 8)}`,
    baseUrl,
    statePath,
    initScriptPath,
    viewport: RECORDING_VIEWPORT,
    timezone,
  });
  const reset = async () => {
    await browser.open(node.route);
    if (previous) await playActions(browser, previous.actions);
  };
  const safely =
    <Input, Output>(run: (input: Input) => Promise<Output>) =>
    async (input: Input): Promise<Output | { error: string }> => {
      try {
        return await run(input);
      } catch (error) {
        return { error: errorText(error) };
      }
    };
  const target = z.string().min(1).describe("A ref from the last snapshot, like @e3, or a CSS selector");

  const tools = {
    open: tool({
      description: `Open a path of the local app. Opening ${node.route} resets the page to the scene's starting state.`,
      inputSchema: z.object({ path: z.string().startsWith("/") }),
      execute: safely(async ({ path: pathname }: { path: string }) => {
        onProgress(`Opening ${pathname}`);
        if (pathname !== node.route) return browser.open(pathname);
        await reset();
        return { reset: true, route: node.route, previousSceneReplayed: previous !== null };
      }),
    }),
    snapshot: tool({
      description: "The page's interactive elements with refs. Optionally scoped to a CSS selector.",
      inputSchema: z.object({ selector: z.string().optional() }),
      execute: safely(async ({ selector }: { selector?: string }) => {
        onProgress("Reading the page");
        return { snapshot: await browser.snapshot(selector) };
      }),
    }),
    click: tool({
      description: "Click an element while exploring.",
      inputSchema: z.object({ target }),
      execute: safely(async ({ target: element }: { target: string }) => {
        await browser.click(element);
        return { clicked: element };
      }),
    }),
    fill: tool({
      description: "Clear an input and type text into it while exploring.",
      inputSchema: z.object({ target, text: z.string() }),
      execute: safely(async ({ target: element, text }: { target: string; text: string }) => {
        await browser.fill(element, text);
        return { filled: element };
      }),
    }),
    press: tool({
      description: "Press a key, like Enter, while exploring.",
      inputSchema: z.object({ key: z.string().min(1) }),
      execute: safely(async ({ key }: { key: string }) => {
        await browser.press(key);
        return { pressed: key };
      }),
    }),
    wait: tool({
      description: "Wait for the page, up to 5 seconds.",
      inputSchema: z.object({ ms: z.number().int().min(100).max(5000) }),
      execute: safely(async ({ ms }: { ms: number }) => {
        await browser.wait(ms);
        return { waited: ms };
      }),
    }),
    getText: tool({
      description: "The text of an element.",
      inputSchema: z.object({ target }),
      execute: safely(async ({ target: element }: { target: string }) => ({
        text: (await browser.text(element)).slice(0, 2000),
      })),
    }),
    describeElement: tool({
      description:
        "Reads an element's stable attributes and proposes CSS selectors for it, each with how many elements it matches.",
      inputSchema: z.object({ target }),
      execute: safely(async ({ target: element }: { target: string }) => {
        const attributes: Record<string, string | null> = {};
        for (const name of DESCRIBED_ATTRIBUTES) attributes[name] = await browser.attribute(element, name);
        const candidates = [];
        for (const selector of candidateSelectors(attributes)) {
          const matches = await browser.count(selector);
          candidates.push({ selector, matches });
        }
        return { attributes, candidates };
      }),
    }),
    countSelector: tool({
      description: "How many elements a CSS selector matches, and whether the first is visible.",
      inputSchema: z.object({ selector: z.string().min(1) }),
      execute: safely(async ({ selector }: { selector: string }) => {
        const matches = await browser.count(selector);
        return { matches, visible: matches > 0 && (await browser.visible(selector)) };
      }),
    }),
  };

  let attempt = 0;
  try {
    await reset();
    const { value, usage } = await runUntilSubmitted({
      model,
      system: recordingExplorerSystemPrompt({ route: node.route, appNotes, signedIn: login !== null }),
      prompt: recordingExplorerUserPrompt({ node, previous, brief }),
      tools,
      maxSteps: MAX_STEPS,
      submit: {
        name: SUBMIT_SCRIPT_TOOL,
        description: "Submit the recording script. Returns errors to fix, or accepted.",
        schema: recordingScriptSchema,
        maxAttempts: MAX_ATTEMPTS,
        check: async (script) => {
          attempt++;
          onProgress(`Checking the script (attempt ${attempt})`);
          const timing = scriptErrors(script, { duration: node.duration });
          if (timing.length > 0) return timing;
          onProgress("Rehearsing the script on the recorder's clock");
          const errors = await rehearse(script.actions).catch((error) => [errorText(error)]);
          if (errors.length > 0) onProgress(`The script needs another pass: ${errors[0]}`);
          return errors;
        },
      },
    });
    return { script: value, usage };
  } finally {
    await browser.close();
    await rm(scratch, { recursive: true, force: true });
  }
}
