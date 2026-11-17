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
import type { RouteCatalogueEntry } from "../catalogues/routes/route-catalogue";
import { MAX_RECORDING_SECONDS, type Project } from "../storyboard/storyboard-schema";
import { scheduleActions } from "./action-schedule";
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
import { type PageRect, recordingRuntimeScript } from "./recording-page-runtime";
import { findClip, readRecordingManifest } from "./recording-status";
import { scriptedTurnChunks } from "./scripted-reply";

const runFile = promisify(execFile);

/** How long a missing target may take to appear before the recording fails. */
export const TARGET_TIMEOUT_MS = 10_000;
const SETTLE_TIMEOUT_MS = 10_000;
const PREROLL_STEPS = 30;
const PREROLL_STEP_MS = 100;
const PAGE_SEED = 20_261_118;
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
      onProgress,
    });
    onProgress({ type: "phase", phase: "proxy" });
    const proxy = await writeProxies({ dir: partial, dpr: spec.dpr });
    const final: RecordingManifest = { ...manifest, proxy };
    await writeFile(path.join(partial, RECORDING_MANIFEST_FILE), `${JSON.stringify(final, null, 2)}\n`);
    await rm(directory, { recursive: true, force: true });
    await rename(partial, directory);
    return { manifest: final, directory, reused: false, secondsPerFrame };
  } catch (error) {
    await rm(partial, { recursive: true, force: true });
    throw error;
  }
}

async function capture({
  spec,
  hash,
  clipId,
  baseUrl,
  framesDir,
  onProgress,
}: {
  spec: CaptureSpec;
  hash: string;
  clipId: string;
  baseUrl: string;
  framesDir: string;
  onProgress: (progress: RecordingProgress) => void;
}): Promise<{ manifest: Omit<RecordingManifest, "proxy">; secondsPerFrame: number }> {
  const entry = spec.routeEntry;
  const fixture = entry.replyFixture;
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
    await context.addInitScript({
      content: recordingRuntimeScript({
        seed: PAGE_SEED,
        css: [
          BASE_CSS,
          ...entry.hiddenSelectors.map((selector) => `${selector} { visibility: hidden !important; }`),
        ].join("\n"),
        chatPath: "/api/ai/chat",
        titlePath: "/api/ai/chat/session/title",
        title: fixture?.title ?? null,
        turns: fixture ? fixture.turns.map((_, turnIndex) => scriptedTurnChunks(fixture, turnIndex)) : [],
      }),
    });
    const page = await context.newPage();
    const network = trackNetwork(page);
    await holdNetworkWhileClockRuns(page, network);
    await page.goto(new URL(spec.route, baseUrl).toString(), { waitUntil: "load", timeout: 120_000 });

    onProgress({ type: "phase", phase: "preroll" });
    for (let step = 0; step < PREROLL_STEPS; step++) {
      await network.runClock(PREROLL_STEP_MS);
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

async function signIn({
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
    if (Date.now() > deadline) {
      throw new Error(
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
  framesDir: string;
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

  for (let frame = 0; frame < frameCount; frame++) {
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
    const point = cursorPointAtFrame({ frame, travels, destinations, rest });
    await page.mouse.move(point.x, point.y);

    for (const input of schedule.inputs[frame]) {
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
            kind: "type",
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

    // Chrome dispatches mouse moves at the next rendering update; wait for it so hover starts on this frame,
    // and let what an input started (a send, a render) finish before page time moves on.
    await page.evaluate("window.__studioObservers.renderingUpdate()");
    if (schedule.inputs[frame].length > 0) await settle(page, network);
    const nextClockMs = Math.round(((frame + 1) * 1000) / spec.fps);
    await network.runClock(nextClockMs - clockMs);
    clockMs = nextClockMs;
    await settle(page, network);

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
