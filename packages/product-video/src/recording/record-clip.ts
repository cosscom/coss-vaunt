import { execFile } from "node:child_process";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  type BrowserContext,
  type CDPSession,
  chromium,
  type Page,
  type Request,
  type Route,
} from "playwright";
import { type RouteCatalogueEntry, routeEntryFor } from "../catalogues/routes/route-catalogue";
import { MAX_RECORDING_SECONDS, type Project } from "../storyboard/storyboard-schema";
import { type FrameInput, scheduleActions } from "./action-schedule";
import {
  type AgentConversation,
  type AgentReplies,
  agentConversation,
  paceReply,
  readAgentReplies,
  writeAgentReplies,
} from "./agent-replies";
import { type CaptureSpec, captureHash, captureSpecFor } from "./capture-hash";
import { cursorPointAtFrame, type Point, restPoint } from "./cursor-path";
import { assertAllowedRecordingHost } from "./host-allowlist";
import type { RecordingProgress } from "./recording-events";
import {
  type CursorSample,
  frameFileName,
  RECORDING_MANIFEST_FILE,
  type RecordingManifest,
  type Rect,
  recordingDirectory,
} from "./recording-manifest";
import { type AgentCaptureState, type PageRect, recordingRuntimeScript } from "./recording-page-runtime";
import { findClip, readRecordingManifest } from "./recording-status";
import { writeRecordingVideo } from "./recording-video";
import type { ReplayStep } from "./replay-chain";
import { GENERIC_REPLY, normalisePrompt, scriptedTurnChunks } from "./scripted-reply";

const runFile = promisify(execFile);

/** How long a missing target may take to appear before the recording fails. */
export const TARGET_TIMEOUT_MS = 10_000;
const SETTLE_TIMEOUT_MS = 10_000;
const PREROLL_STEPS = 30;
const PREROLL_STEP_MS = 100;
const PAGE_SEED = 20_261_118;
const REPLAY_FPS = 10;
const PROXY_DPR = 1;
const FFMPEG = "/usr/bin/ffmpeg";

const BASE_CSS = [
  "*, *::before, *::after { cursor: none !important; caret-color: transparent !important; }",
  "nextjs-portal { display: none !important; }",
].join("\n");

export type RecordClipResult = {
  manifest: RecordingManifest;
  /** Absolute folder holding `manifest.json`, `frames/` and `proxy/`. */
  directory: string;
  /** True when a recording for this capture hash already existed and nothing was recorded. */
  reused: boolean;
  secondsPerFrame: number | null;
};

/** Records one clip into `<projectDir>/recordings/<clipId>/<captureHash>/`, or reuses the existing recording. */
export async function recordClip({
  project,
  clipId,
  theme = project.settings.theme,
  projectDir,
  force = false,
  onProgress = () => undefined,
}: {
  project: Project;
  clipId: string;
  theme?: "light" | "dark";
  projectDir: string;
  force?: boolean;
  onProgress?: (progress: RecordingProgress) => void;
}): Promise<RecordClipResult> {
  const clip = findClip(project, clipId);
  if (!clip) throw new Error(`Clip ${clipId} is not in project ${project.id}`);
  if (clip.source.kind !== "recording") throw new Error(`Clip "${clip.name}" is not a recording`);
  if (clip.duration > MAX_RECORDING_SECONDS) {
    throw new Error(
      `Clip "${clip.name}" is ${clip.duration} s; recorded clips are at most ${MAX_RECORDING_SECONDS} s`
    );
  }
  assertAllowedRecordingHost(project.settings.baseUrl);
  const spec = captureSpecFor({ project, clip, theme });
  const hash = captureHash(spec);
  const directory = path.join(projectDir, recordingDirectory(clip.id, hash));

  const existing = await readRecordingManifest(directory);
  if (existing && !force) return { manifest: existing, directory, reused: true, secondsPerFrame: null };

  const replies = await ensureAgentReplies({
    spec,
    baseUrl: project.settings.baseUrl,
    projectDir,
    onProgress,
  });
  const partial = `${directory}.partial-${process.pid}`;
  await rm(partial, { recursive: true, force: true });
  await mkdir(path.join(partial, "frames"), { recursive: true });
  try {
    const { manifest, secondsPerFrame } = await capture({
      spec,
      hash,
      clipId: clip.id,
      baseUrl: project.settings.baseUrl,
      framesDir: path.join(partial, "frames"),
      replies,
      onProgress,
    });
    onProgress({ type: "phase", phase: "proxy" });
    const proxy = await writeProxies({ dir: partial, dpr: spec.dpr });
    const video = await writeRecordingVideo({ dir: partial, fps: spec.fps, viewport: spec.viewport });
    const final: RecordingManifest = { ...manifest, proxy, video };
    await writeFile(path.join(partial, RECORDING_MANIFEST_FILE), `${JSON.stringify(final, null, 2)}\n`);
    await rm(directory, { recursive: true, force: true });
    await rename(partial, directory);
    return { manifest: final, directory, reused: false, secondsPerFrame };
  } catch (error) {
    await rm(partial, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Plays a clip exactly as `recordClip` would, on the same fake clock and page runtime, without taking
 * screenshots; throws what the recording would. A missing target's error says when, if ever, it shows up.
 */
export async function rehearseClip({
  project,
  clipId,
  projectDir,
}: {
  project: Project;
  clipId: string;
  /** Where the agent's captured replies are kept; without it a rehearsal captures them and forgets them. */
  projectDir?: string;
}): Promise<void> {
  const clip = findClip(project, clipId);
  if (!clip || clip.source.kind !== "recording")
    throw new Error(`Clip ${clipId} is not a recording in this project`);
  assertAllowedRecordingHost(project.settings.baseUrl);
  const spec = captureSpecFor({ project, clip });
  const replies = await ensureAgentReplies({
    spec,
    baseUrl: project.settings.baseUrl,
    projectDir: projectDir ?? null,
    onProgress: () => undefined,
  });
  await capture({
    spec,
    hash: captureHash(spec),
    clipId,
    baseUrl: project.settings.baseUrl,
    framesDir: null,
    replies,
    onProgress: () => undefined,
  });
}

/** How long the real agent gets to answer one message while its reply is captured. */
const AGENT_REPLY_TIMEOUT_MS = 180_000;

/**
 * The real agent's replies to what the clip sends, captured once in real time and kept in the project, so the
 * frame-by-frame recording replays a genuine answer and every take shows the same one. Null when the clip
 * doesn't talk to the agent.
 */
async function ensureAgentReplies({
  spec,
  baseUrl,
  projectDir,
  onProgress,
}: {
  spec: CaptureSpec;
  baseUrl: string;
  projectDir: string | null;
  onProgress: (progress: RecordingProgress) => void;
}): Promise<AgentReplies | null> {
  const steps = [...(spec.replay ?? []), { route: spec.route, actions: spec.actions }].map((step) => ({
    ...step,
    entry: routeEntryFor(step.route),
  }));
  const conversation = agentConversation(steps);
  if (!conversation) return null;
  if (projectDir) {
    const stored = await readAgentReplies(projectDir, conversation);
    if (stored) return stored;
  }
  onProgress({ type: "phase", phase: "agent" });
  const replies = await captureAgentReplies({
    baseUrl,
    conversation,
    entry: steps[0]?.entry ?? spec.routeEntry,
  });
  if (projectDir) await writeAgentReplies(projectDir, replies);
  return replies;
}

async function captureAgentReplies({
  baseUrl,
  conversation,
  entry,
}: {
  baseUrl: string;
  conversation: AgentConversation;
  entry: RouteCatalogueEntry;
}): Promise<AgentReplies> {
  const composer = entry.targets.find((target) => target.name === "composer")?.selector;
  const send = entry.targets.find((target) => target.name === "send")?.selector;
  if (!composer) throw new Error(`${conversation.route} has no agent composer to send messages from`);
  const browser = await chromium.launch();
  try {
    const storageState = await signIn({ baseUrl, entry, newContext: () => browser.newContext() });
    const context = await browser.newContext({
      storageState,
      viewport: entry.viewport,
      timezoneId: entry.timezone,
      locale: "en-US",
    });
    await context.addInitScript({ content: routeRuntimeScript(entry, "", { capture: true }) });
    const page = await context.newPage();
    await page.goto(new URL(conversation.route, baseUrl).toString(), { waitUntil: "load", timeout: 120_000 });
    for (const [index, message] of conversation.messages.entries()) {
      await page.locator(composer).first().fill(message, { timeout: 60_000 });
      if (send) await page.locator(send).first().click();
      else await page.locator(composer).first().press("Enter");
      try {
        await page.waitForFunction(
          (turn) =>
            (window as unknown as { __studioAgentCapture: AgentCaptureState }).__studioAgentCapture.turns[
              turn
            ]?.done === true,
          index,
          { timeout: AGENT_REPLY_TIMEOUT_MS }
        );
      } catch {
        throw new Error(
          `The Cal.com agent at ${baseUrl} didn't answer "${message}". Is its Trigger.dev agent worker running?`
        );
      }
    }
    // The session title arrives a moment after the first reply.
    await page
      .waitForFunction(
        () =>
          (window as unknown as { __studioAgentCapture: AgentCaptureState }).__studioAgentCapture.title !==
          null,
        null,
        { timeout: 10_000 }
      )
      .catch(() => undefined);
    const captured = await page.evaluate(
      () => (window as unknown as { __studioAgentCapture: AgentCaptureState }).__studioAgentCapture
    );
    const turns = captured.turns.map((turn) => turn.chunks);
    const failed = turns.find(
      (chunks) => chunks.length === 0 || chunks.some((entry) => entry.chunk.type === "error")
    );
    if (failed) {
      const error = failed.find((entry) => entry.chunk.type === "error")?.chunk;
      throw new Error(
        `The Cal.com agent replied with an error${error ? `: ${JSON.stringify(error).slice(0, 300)}` : ""}`
      );
    }
    return {
      ...conversation,
      title: captured.title,
      turns: turns.map(paceReply),
      capturedAt: new Date().toISOString(),
    };
  } finally {
    await browser.close();
  }
}

async function capture({
  spec,
  hash,
  clipId,
  baseUrl,
  framesDir,
  replies,
  onProgress,
}: {
  spec: CaptureSpec;
  hash: string;
  clipId: string;
  baseUrl: string;
  /** Null rehearses: the same run with no screenshots. */
  framesDir: string | null;
  /** The real agent's captured answers to what the clip sends; null plays the route's script. */
  replies: AgentReplies | null;
  onProgress: (progress: RecordingProgress) => void;
}): Promise<{ manifest: Omit<RecordingManifest, "proxy">; secondsPerFrame: number }> {
  const entry = spec.routeEntry;
  const browser = await chromium.launch({ args: ["--force-color-profile=srgb", "--hide-scrollbars"] });
  try {
    onProgress({ type: "phase", phase: "login" });
    const storageState = await signIn({ baseUrl, entry, newContext: () => browser.newContext() });

    onProgress({ type: "phase", phase: "load" });
    const context = await browser.newContext({
      storageState,
      viewport: spec.viewport,
      deviceScaleFactor: spec.dpr,
      timezoneId: entry.timezone,
      locale: "en-US",
      colorScheme: spec.theme,
      reducedMotion: "no-preference",
    });
    const startTime = Date.parse(entry.clockTime);
    await context.clock.install({ time: startTime });
    await context.clock.pauseAt(startTime + 1000);
    await context.addInitScript({ content: routeRuntimeScript(entry, BASE_CSS, { replies }) });
    const page = await context.newPage();
    // The page runtime reports writes it couldn't classify; they belong in the job's log, not lost in the page.
    page.on("console", (message) => {
      if (message.text().startsWith("[studio]")) process.stderr.write(`${message.text()}\n`);
    });
    const network = trackNetwork(page);
    await holdNetworkWhileClockRuns(page, network);
    const startRoute = spec.replay?.[0]?.route ?? spec.route;
    await page.goto(new URL(startRoute, baseUrl).toString(), { waitUntil: "load", timeout: 120_000 });

    onProgress({ type: "phase", phase: "preroll" });
    for (let step = 0; step < PREROLL_STEPS; step++) {
      await network.runClock(PREROLL_STEP_MS);
      await settle(page, network);
    }
    if (spec.replay) {
      onProgress({ type: "phase", phase: "replay" });
      for (const step of spec.replay) await replayRecording(page, network, step);
      const rest = restPoint(spec.viewport);
      await page.mouse.move(rest.x, rest.y);
      await settle(page, network);
    }

    onProgress({ type: "phase", phase: "capture" });
    const result = await captureFrames({ page, context, spec, hash, clipId, framesDir, network, onProgress });
    await context.close();
    return result;
  } finally {
    await browser.close();
  }
}

/**
 * The page runtime for a route: seeded randomness, the agent's replies and its hidden elements. Replies are the
 * real agent's captured answers when given, else the route's scripted fixture; `capture` lets the real agent answer.
 */
export function routeRuntimeScript(
  entry: RouteCatalogueEntry,
  css = "",
  { replies = null, capture = false }: { replies?: AgentReplies | null; capture?: boolean } = {}
): string {
  const fixture = entry.replyFixture;
  return recordingRuntimeScript({
    seed: PAGE_SEED,
    css: [
      css,
      ...entry.hiddenSelectors.map((selector) => `${selector} { visibility: hidden !important; }`),
    ].join("\n"),
    chatPath: "/api/ai/chat",
    titlePath: "/api/ai/chat/session/title",
    title: replies ? replies.title : (fixture?.title ?? null),
    turns: replies
      ? replies.turns
      : fixture
        ? fixture.turns.map((_, turnIndex) => scriptedTurnChunks(fixture, turnIndex))
        : [],
    prompt: replies ? null : fixture?.prompt ? normalisePrompt(fixture.prompt) : null,
    fallback: { title: GENERIC_REPLY.title, turn: scriptedTurnChunks(GENERIC_REPLY, 0) },
    capture,
  });
}

/** Signs in as the route's synthetic user and returns the browser storage state. */
export async function signIn({
  baseUrl,
  entry,
  newContext,
}: {
  baseUrl: string;
  entry: RouteCatalogueEntry;
  newContext: () => Promise<BrowserContext>;
}): Promise<Awaited<ReturnType<BrowserContext["storageState"]>>> {
  const context = await newContext();
  try {
    const page = await context.newPage();
    await page.goto(new URL("/auth/login", baseUrl).toString(), { timeout: 120_000 });
    await page.fill("input[name=email]", entry.login.email);
    await page.fill("input[name=password]", entry.login.password);
    await Promise.all([
      page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 60_000, waitUntil: "commit" }),
      page.click("button[type=submit]"),
    ]);
    return await context.storageState();
  } catch (error) {
    throw new Error(`Couldn't sign in as ${entry.login.email} at ${baseUrl}: ${(error as Error).message}`);
  } finally {
    await context.close();
  }
}

type NetworkTracker = {
  inFlight: () => number;
  idle: (timeoutMs: number) => Promise<void>;
  /** Advances page time; requests made meanwhile wait until it stops, so responses land between frames. */
  runClock: (ms: number) => Promise<void>;
};

/** Requests the page is waiting on; streams that never end (websockets, event sources) don't count. */
function trackNetwork(page: Page): NetworkTracker {
  const pending = new Set<Request>();
  let waiters: Array<() => void> = [];
  const done = (request: Request) => {
    pending.delete(request);
    if (pending.size > 0) return;
    for (const resolve of waiters) resolve();
    waiters = [];
  };
  page.on("request", (request) => {
    const type = request.resourceType();
    if (type === "websocket" || type === "eventsource") return;
    pending.add(request);
  });
  page.on("requestfinished", done);
  page.on("requestfailed", done);
  return {
    runClock: (ms) => page.clock.runFor(ms),
    inFlight: () => pending.size,
    idle: (timeoutMs) =>
      pending.size === 0
        ? Promise.resolve()
        : withTimeout(new Promise<void>((resolve) => waiters.push(resolve)), timeoutMs, "network").catch(
            () => undefined
          ),
  };
}

/**
 * The fake clock yields to the real event loop after every timer, so a response arriving mid-advance would land
 * at a different page time on every run. Holding requests until the advance ends pins them to frame boundaries.
 */
async function holdNetworkWhileClockRuns(page: Page, network: NetworkTracker): Promise<void> {
  let running = false;
  const held: Route[] = [];
  const release = (route: Route) => route.continue().catch(() => undefined);
  await page.route("**/*", (route) => {
    if (running) held.push(route);
    else void release(route);
  });
  const runFor = network.runClock;
  network.runClock = async (ms) => {
    running = true;
    try {
      await runFor(ms);
    } finally {
      running = false;
      for (const route of held.splice(0)) void release(route);
    }
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Lets data, images and fonts land, then pins every animation to its age in page time. */
async function settle(page: Page, network: NetworkTracker): Promise<void> {
  for (let round = 0; round < 5; round++) {
    await network.idle(SETTLE_TIMEOUT_MS);
    await withTimeout(page.evaluate("window.__studio.settle()"), SETTLE_TIMEOUT_MS, "images and fonts").catch(
      () => undefined
    );
    if (network.inFlight() === 0) break;
  }
  await page.evaluate("window.__studio.stepAnimations()");
}

class TargetMissingError extends Error {
  constructor(
    readonly selector: string,
    message: string
  ) {
    super(message);
  }
}

const PROBE_STEP_MS = 100;
const PROBE_LIMIT_MS = 5_000;

/** Runs page time on until the missing target shows, so the error can say how late the action was. */
async function explainMissingTarget(
  page: Page,
  network: NetworkTracker,
  error: TargetMissingError,
  atSeconds: number
): Promise<Error> {
  for (let waited = PROBE_STEP_MS; waited <= PROBE_LIMIT_MS; waited += PROBE_STEP_MS) {
    await network.runClock(PROBE_STEP_MS);
    await settle(page, network);
    if (await rectOf(page, error.selector)) {
      return new Error(
        `${error.message}: page time doesn't move while the recorder waits, and at ${atSeconds.toFixed(2)} s into the clip it wasn't on screen yet; it shows ${(waited / 1000).toFixed(1)} s later`
      );
    }
  }
  return new Error(
    `${error.message}: at ${atSeconds.toFixed(2)} s into the clip it wasn't on screen, and it doesn't show within ${PROBE_LIMIT_MS / 1000} s after`
  );
}

async function rectOf(page: Page, selector: string): Promise<PageRect | null> {
  return (await page.evaluate(`window.__studio.rectOf(${JSON.stringify(selector)})`)) as PageRect | null;
}

async function waitForTarget(
  page: Page,
  network: NetworkTracker,
  { selector, actionIndex, kind }: { selector: string; actionIndex: number; kind: string }
): Promise<PageRect> {
  const deadline = Date.now() + TARGET_TIMEOUT_MS;
  for (;;) {
    const rect = await rectOf(page, selector);
    if (rect) return rect;
    // Like a viewer scrolling to it: a target below the fold comes into view instead of failing.
    if (await page.evaluate(`window.__studio.reveal(${JSON.stringify(selector)})`)) {
      await settle(page, network);
      continue;
    }
    if (Date.now() > deadline) {
      throw new TargetMissingError(
        selector,
        `Action ${actionIndex} (${kind}) couldn't find ${selector} on screen within ${TARGET_TIMEOUT_MS / 1000} s`
      );
    }
    await network.idle(500);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const centre = (rect: PageRect): Point => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
const round2 = (value: number) => Math.round(value * 100) / 100;
const roundRect = (rect: PageRect | null): Rect | null =>
  rect && { x: round2(rect.x), y: round2(rect.y), width: round2(rect.width), height: round2(rect.height) };

async function sendInput(
  page: Page,
  network: NetworkTracker,
  input: FrameInput,
  typeKind: string
): Promise<void> {
  switch (input.kind) {
    case "down":
      await page.mouse.down();
      break;
    case "up":
      await page.mouse.up();
      break;
    case "focus": {
      await waitForTarget(page, network, {
        selector: input.target,
        actionIndex: input.actionIndex,
        kind: typeKind,
      });
      const focused = await page.evaluate(
        (selector) => document.querySelector(selector)?.contains(document.activeElement) ?? false,
        input.target
      );
      if (!focused) await page.locator(input.target).first().focus();
      break;
    }
    case "text":
      await page.keyboard.type(input.text);
      break;
    case "key":
      await page.keyboard.press(input.key);
      break;
  }
}

/**
 * Plays a recording this clip continues from at a coarse frame rate on the same fake clock, with no screenshots,
 * so the page reaches the same state on every run; the pointer jumps straight to each target.
 */
async function replayRecording(page: Page, network: NetworkTracker, step: ReplayStep): Promise<void> {
  const schedule = scheduleActions({ actions: step.actions, duration: step.duration, fps: REPLAY_FPS });
  const stepMs = 1000 / REPLAY_FPS;
  for (let frame = 0; frame < schedule.frameCount; frame++) {
    for (const travel of schedule.travels) {
      if (travel.endFrame !== frame) continue;
      const kind = `replayed ${step.actions[travel.actionIndex]?.kind ?? "action"}`;
      const rect = await waitForTarget(page, network, {
        selector: travel.target,
        actionIndex: travel.actionIndex,
        kind,
      });
      const point = centre(rect);
      await page.mouse.move(point.x, point.y);
    }
    for (const input of schedule.inputs[frame]) await sendInput(page, network, input, "replayed type");
    await page.evaluate("window.__studioObservers.renderingUpdate()");
    if (schedule.inputs[frame].length > 0) await settle(page, network);
    await network.runClock(stepMs);
    await settle(page, network);
  }
}

async function captureFrames({
  page,
  context,
  spec,
  hash,
  clipId,
  framesDir,
  network,
  onProgress,
}: {
  page: Page;
  context: BrowserContext;
  spec: CaptureSpec;
  hash: string;
  clipId: string;
  framesDir: string | null;
  network: NetworkTracker;
  onProgress: (progress: RecordingProgress) => void;
}): Promise<{ manifest: Omit<RecordingManifest, "proxy">; secondsPerFrame: number }> {
  const schedule = scheduleActions({ actions: spec.actions, duration: spec.duration, fps: spec.fps });
  const { frameCount, travels } = schedule;
  const cdp: CDPSession = await context.newCDPSession(page);
  // Emulation is per CDP session: without this, this session's screenshots come back at 1× whatever the context's DPR.
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    ...spec.viewport,
    deviceScaleFactor: spec.dpr,
    mobile: false,
  });
  const rest = restPoint(spec.viewport);
  const destinations: Array<Point | undefined> = [];
  const cursor: CursorSample[] = [];
  const focus: Array<Rect | null> = [];
  const visible = travels.length > 0;
  const kindOf = (actionIndex: number) => spec.actions[actionIndex]?.kind ?? "action";
  const started = Date.now();
  let clockMs = 0;
  let point: Point = rest;

  for (let frame = 0; frame < frameCount; frame++) {
    try {
      await stepFrame(frame);
    } catch (error) {
      if (framesDir !== null || !(error instanceof TargetMissingError)) throw error;
      throw await explainMissingTarget(page, network, error, frame / spec.fps);
    }
    if (framesDir === null) continue;

    const shot = (await cdp.send("Page.captureScreenshot", {
      format: "png",
      optimizeForSpeed: true,
      fromSurface: true,
    })) as { data: string };
    await writeFile(path.join(framesDir, frameFileName(frame)), Buffer.from(shot.data, "base64"));

    cursor.push({ x: round2(point.x), y: round2(point.y), pressed: schedule.pressed[frame], visible });
    focus.push(spec.focus ? roundRect(await rectOf(page, spec.focus)) : null);

    const elapsedSeconds = (Date.now() - started) / 1000;
    onProgress({
      type: "frame",
      frame: frame + 1,
      frameCount,
      elapsedSeconds,
      etaSeconds: (elapsedSeconds / (frame + 1)) * (frameCount - frame - 1),
    });
  }

  async function stepFrame(frame: number): Promise<void> {
    for (const [index, travel] of travels.entries()) {
      if (frame < travel.startFrame || frame > travel.endFrame) continue;
      const target = {
        selector: travel.target,
        actionIndex: travel.actionIndex,
        kind: kindOf(travel.actionIndex),
      };
      // Re-read every frame of the travel, so the cursor lands on a target that moved while it travelled.
      destinations[index] = centre(await waitForTarget(page, network, target));
    }
    point = cursorPointAtFrame({ frame, travels, destinations, rest });
    await page.mouse.move(point.x, point.y);

    for (const input of schedule.inputs[frame]) await sendInput(page, network, input, "type");

    // Chrome dispatches mouse moves at the next rendering update; wait for it so hover starts on this frame,
    // and let what an input started (a send, a render) finish before page time moves on.
    await page.evaluate("window.__studioObservers.renderingUpdate()");
    if (schedule.inputs[frame].length > 0) await settle(page, network);
    const nextClockMs = Math.round(((frame + 1) * 1000) / spec.fps);
    await network.runClock(nextClockMs - clockMs);
    clockMs = nextClockMs;
    await settle(page, network);
  }

  return {
    manifest: {
      version: 1,
      clipId,
      captureHash: hash,
      theme: spec.theme,
      fps: spec.fps,
      frameCount,
      viewport: spec.viewport,
      dpr: spec.dpr,
      cursor,
      focus,
    },
    secondsPerFrame: (Date.now() - started) / 1000 / frameCount,
  };
}

/** Viewport-sized WebP copies for smooth editor playback; skipped without a WebP-capable ffmpeg. */
async function writeProxies({ dir, dpr }: { dir: string; dpr: number }): Promise<RecordingManifest["proxy"]> {
  const ffmpegExists = await stat(FFMPEG).then(
    () => true,
    () => false
  );
  if (!ffmpegExists) return null;
  await mkdir(path.join(dir, "proxy"), { recursive: true });
  const scale = PROXY_DPR / dpr;
  await runFile(FFMPEG, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-start_number",
    "0",
    "-i",
    path.join(dir, "frames", "%06d.png"),
    "-vf",
    `scale=trunc(iw*${scale}):trunc(ih*${scale}):flags=lanczos`,
    "-c:v",
    "libwebp",
    "-quality",
    "82",
    "-start_number",
    "0",
    path.join(dir, "proxy", "%06d.webp"),
  ]);
  return { dpr: PROXY_DPR };
}
