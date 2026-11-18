/// <reference lib="dom" />
import { classifyRequest, fakeTrpcResponse } from "./request-fakes";
import type { TimedChunk } from "./scripted-reply";

type StudioRequests = { classify: typeof classifyRequest; fakeTrpc: typeof fakeTrpcResponse };

export type RecordingPageConfig = {
  seed: number;
  /** CSS added to every page: hides the OS cursor, the caret, dev overlays and the route's noisy elements. */
  css: string;
  chatPath: string;
  titlePath: string;
  title: string | null;
  /** Timed chunks per user turn; empty when the route has no scripted reply. */
  turns: TimedChunk[][];
  /** The normalised message the turns answer; null answers every message. */
  prompt: string | null;
  /** Played, every turn, when the first message isn't `prompt`. */
  fallback: { title: string | null; turn: TimedChunk[] };
  /**
   * Capturing the real agent: chat and title requests reach the app, and each reply's chunks are recorded with
   * their arrival times on `window.__studioAgentCapture` while the page shows them as normal.
   */
  capture?: boolean;
};

/** What a capture run leaves on `window.__studioAgentCapture`. */
export type AgentCaptureState = {
  turns: Array<{ chunks: TimedChunk[]; done: boolean }>;
  title: string | null;
};

export type PageRect = { x: number; y: number; width: number; height: number };

/** What the recorder calls on `window.__studio` once per frame. */
export type RecordingPageApi = {
  stepAnimations(): void;
  settle(): Promise<void>;
  rectOf(selector: string): PageRect | null;
  /** Scrolls an element that's in the page but off screen to the middle of the view; false when there's nothing to do. */
  reveal(selector: string): boolean;
};

type ObserverGate = { deliver(): Promise<void>; renderingUpdate(): Promise<void> };

/**
 * Intersection and resize observers report on the browser's real rendering schedule, which drifts against page time
 * from run to run. This holds their callbacks and delivers them only when the recorder settles a frame.
 */
export function installObserverGate(): void {
  const queue: Array<() => void> = [];
  const NativeIntersectionObserver = window.IntersectionObserver;
  const NativeResizeObserver = window.ResizeObserver;
  window.IntersectionObserver = class extends NativeIntersectionObserver {
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      super((entries, observer) => queue.push(() => callback.call(observer, entries, observer)), options);
    }
  };
  window.ResizeObserver = class extends NativeResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      super((entries, observer) => queue.push(() => callback.call(observer, entries, observer)));
    }
  };
  // An observer's first report waits for a rendering update, which also queues every other observer's reports.
  const renderingUpdate = () =>
    new Promise<void>((resolve) => {
      const probe = new NativeIntersectionObserver(() => {
        probe.disconnect();
        resolve();
      });
      probe.observe(document.documentElement);
    });
  const gate: ObserverGate = {
    renderingUpdate,
    async deliver() {
      for (let round = 0; round < 3; round++) {
        await renderingUpdate();
        if (queue.length === 0) return;
        for (const report of queue.splice(0)) report();
      }
    },
  };
  (window as unknown as { __studioObservers: ObserverGate }).__studioObservers = gate;
}

/**
 * Runs inside the page before any of its scripts, so it is serialised with `toString()`: no imports, no closures
 * over module scope. Page timers are Playwright's fake clock, so scripted replies and animations follow page time.
 */
export function installRecordingRuntime(config: RecordingPageConfig): void {
  // Playwright replays install → pauseAt with the real milliseconds between the two calls, which leaks into
  // performance.now(); start page ticks from zero instead.
  const clock = (globalThis as { __pwClock?: { controller?: { now(): number; _now?: { ticks: number } } } })
    .__pwClock?.controller;
  if (clock?._now) {
    clock.now();
    clock._now.ticks = 0;
  }
  const random = (seed: number) => {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  Math.random = random(config.seed);
  const uuidRandom = random(config.seed ^ 0x5bd1e995);
  crypto.randomUUID = () => {
    const hex = Array.from({ length: 32 }, () => Math.floor(uuidRandom() * 16).toString(16));
    hex[12] = "4";
    hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
    const s = hex.join("");
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`;
  };

  const ensureStyle = () => {
    if (!document.head || document.getElementById("__studio-style")) return;
    const style = document.createElement("style");
    style.id = "__studio-style";
    style.textContent = config.css;
    document.head.appendChild(style);
  };
  document.addEventListener("DOMContentLoaded", ensureStyle);

  const originalFetch = window.fetch;
  if (config.capture)
    (window as unknown as { __studioAgentCapture: AgentCaptureState }).__studioAgentCapture = {
      turns: [],
      title: null,
    };
  const requests = (globalThis as unknown as { __studioRequests: StudioRequests }).__studioRequests;
  /** What the page tried to write, for a look in DevTools: `window.__studioFaked`. */
  const faked: Array<{ kind: string; method: string; url: string }> = [];
  (window as unknown as { __studioFaked: typeof faked }).__studioFaked = faked;
  let turn = 0;
  let answered: "fixture" | "fallback" | null = null;
  // The newest user message's text, from the AI SDK request body; null when the body has none.
  const userText = (body: unknown): string | null => {
    const messages = (
      body as { messages?: Array<{ role?: string; parts?: Array<{ type?: string; text?: string }> }> }
    )?.messages;
    const last = Array.isArray(messages)
      ? [...messages].reverse().find((message) => message.role === "user")
      : null;
    const text = (last?.parts ?? []).map((part) => (part.type === "text" ? (part.text ?? "") : "")).join(" ");
    return text.trim() ? text : null;
  };
  const normalise = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  window.fetch = function scriptedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input), location.href);
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const local = url.origin === location.origin;
    if (config.capture && local && url.pathname === config.chatPath && method === "POST") {
      const state = (window as unknown as { __studioAgentCapture: AgentCaptureState }).__studioAgentCapture;
      const turnState = { chunks: [] as TimedChunk[], done: false };
      state.turns.push(turnState);
      const started = performance.now();
      return originalFetch(input, init).then((response) => {
        if (!response.body) {
          turnState.done = true;
          return response;
        }
        const [mine, theirs] = response.body.tee();
        void (async () => {
          const reader = mine.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            for (let end = buffer.indexOf("\n\n"); end >= 0; end = buffer.indexOf("\n\n")) {
              const block = buffer.slice(0, end);
              buffer = buffer.slice(end + 2);
              const data = block
                .split("\n")
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.slice(5).trim())
                .join("");
              if (!data || data === "[DONE]") continue;
              try {
                turnState.chunks.push({
                  atMs: Math.round(performance.now() - started),
                  chunk: JSON.parse(data),
                });
              } catch {
                // Not JSON: a keep-alive or comment line.
              }
            }
          }
          turnState.done = true;
        })();
        return new Response(theirs, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      });
    }
    if (config.capture && local && url.pathname === config.titlePath && method === "GET") {
      const state = (window as unknown as { __studioAgentCapture: AgentCaptureState }).__studioAgentCapture;
      return originalFetch(input, init).then(async (response) => {
        const body = (await response
          .clone()
          .json()
          .catch(() => null)) as { title?: unknown } | null;
        if (typeof body?.title === "string") state.title = body.title;
        return response;
      });
    }
    // Every chat goes to a scripted reply: the route's fixture, the captured real one, or the generic one.
    if (local && url.pathname === config.chatPath && method === "POST") {
      let sessionUid: unknown;
      let body: unknown;
      try {
        body = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
        sessionUid = (body as { sessionUid?: unknown }).sessionUid;
      } catch {
        sessionUid = undefined;
      }
      if (answered === null) {
        const text = userText(body);
        answered =
          config.turns.length > 0 &&
          (config.prompt === null || text === null || normalise(text) === config.prompt)
            ? "fixture"
            : "fallback";
      }
      const chunks =
        answered === "fixture" ? config.turns[Math.min(turn, config.turns.length - 1)] : config.fallback.turn;
      turn++;
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const { atMs, chunk } of chunks) {
            setTimeout(() => controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)), atMs);
          }
          const endMs = chunks.length > 0 ? chunks[chunks.length - 1].atMs : 0;
          setTimeout(() => {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          }, endMs + 1);
        },
      });
      const headers = new Headers({
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "x-vercel-ai-ui-message-stream": "v1",
      });
      if (typeof sessionUid === "string") headers.set("x-cal-agent-session-uid", sessionUid);
      return Promise.resolve(new Response(stream, { status: 200, headers }));
    }
    if (local && url.pathname === config.titlePath && method === "GET") {
      const title = answered === "fallback" ? config.fallback.title : config.title;
      const body = JSON.stringify({ title: turn > 0 ? title : null });
      return Promise.resolve(
        new Response(body, { status: 200, headers: { "content-type": "application/json" } })
      );
    }
    const headerOf = (name: string) =>
      new Headers(init?.headers ?? request?.headers ?? undefined).get(name) ?? null;
    const kind = requests.classify({
      method,
      url: url.href,
      pageOrigin: location.origin,
      serverAction: headerOf("next-action") !== null,
    });
    if (kind === "read" || kind === "trpc-query") return originalFetch.call(window, input, init);
    faked.push({ kind, method, url: `${url.pathname}${url.search}` });
    const json = (body: string) =>
      new Response(body, { status: 200, headers: { "content-type": "application/json" } });
    if (kind === "trpc-mutation") {
      const calls = decodeURIComponent(url.pathname.split("/").pop() ?? "").split(",").length;
      const batch = url.searchParams.get("batch") === "1";
      const bodyText =
        typeof init?.body === "string"
          ? Promise.resolve(init.body)
          : request
            ? request.clone().text()
            : Promise.resolve("");
      return bodyText.then((body) => json(requests.fakeTrpc({ body, batch, calls })));
    }
    if (kind === "server-action") {
      console.warn(`[studio] faked a server action at ${url.pathname}; the page may not update`);
      return Promise.resolve(
        new Response("", { status: 200, headers: { "content-type": "text/x-component" } })
      );
    }
    if (kind === "unclassified") {
      console.warn(`[studio] couldn't classify ${method} ${url.pathname}; blocked it`);
      return Promise.resolve(new Response("", { status: 204 }));
    }
    return Promise.resolve(json("{}"));
  };

  navigator.sendBeacon = (url: string | URL) => {
    faked.push({ kind: "external-write", method: "BEACON", url: String(url) });
    return true;
  };
  const xhrMethods = new WeakMap<XMLHttpRequest, { method: string; url: string }>();
  const nativeOpen = XMLHttpRequest.prototype.open as (this: XMLHttpRequest, ...args: unknown[]) => void;
  const nativeSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function open(this: XMLHttpRequest, ...args: unknown[]) {
    xhrMethods.set(this, { method: String(args[0]).toUpperCase(), url: String(args[1]) });
    nativeOpen.apply(this, args);
  } as typeof XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.send = function send(
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const opened = xhrMethods.get(this);
    if (opened && !["GET", "HEAD", "OPTIONS"].includes(opened.method)) {
      console.warn(`[studio] couldn't classify XHR ${opened.method} ${opened.url}; blocked it`);
      faked.push({ kind: "unclassified", method: opened.method, url: opened.url });
      this.abort();
      return;
    }
    nativeSend.call(this, body);
  };

  const births = new WeakMap<Animation | SVGSVGElement, number>();
  const nextTask = () =>
    new Promise<void>((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve();
      channel.port2.postMessage(null);
    });
  const inViewport = (rect: DOMRect) =>
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < innerHeight &&
    rect.left < innerWidth;

  const api: RecordingPageApi = {
    stepAnimations() {
      ensureStyle();
      const now = performance.now();
      for (const animation of document.getAnimations()) {
        if (!births.has(animation)) births.set(animation, now);
        const age = now - (births.get(animation) ?? now);
        const end = animation.effect?.getComputedTiming().endTime;
        if (typeof end === "number" && Number.isFinite(end) && age >= end) {
          if (animation.playState !== "finished") animation.finish();
          continue;
        }
        animation.pause();
        animation.currentTime = age;
      }
      // SMIL runs on each <svg>'s own real-time clock, outside document.getAnimations().
      for (const svg of document.querySelectorAll<SVGSVGElement>(
        "svg:has(animate, animateTransform, animateMotion, set)"
      )) {
        if (svg.ownerSVGElement) continue;
        if (!births.has(svg)) births.set(svg, now);
        svg.pauseAnimations();
        svg.setCurrentTime((now - (births.get(svg) ?? now)) / 1000);
      }
    },
    async settle() {
      await nextTask();
      const pending = Array.from(document.images).filter(
        (image) => !image.complete && inViewport(image.getBoundingClientRect())
      );
      await Promise.all(
        pending.map(
          (image) =>
            new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            })
        )
      );
      await Promise.all(
        Array.from(document.images)
          .filter(
            (image) => image.complete && image.naturalWidth > 0 && inViewport(image.getBoundingClientRect())
          )
          .map((image) => image.decode().catch(() => undefined))
      );
      await document.fonts.ready;
      await (window as unknown as { __studioObservers: ObserverGate }).__studioObservers.deliver();
      await nextTask();
      await nextTask();
    },
    rectOf(selector) {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      if (!inViewport(rect)) return null;
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    },
    reveal(selector) {
      const element = document.querySelector(selector);
      if (!element || inViewport(element.getBoundingClientRect())) return false;
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      return true;
    },
  };
  (window as unknown as { __studio: RecordingPageApi }).__studio = api;
}

/** The init script source; tsx compiles with keepNames, so `__name` must exist before the function runs. */
export function recordingRuntimeScript(config: RecordingPageConfig): string {
  return [
    "globalThis.__name ??= (target) => target;",
    `globalThis.__studioRequests = { classify: (${classifyRequest.toString()}), fakeTrpc: (${fakeTrpcResponse.toString()}) };`,
    `(${installObserverGate.toString()})();`,
    `(${installRecordingRuntime.toString()})(${JSON.stringify(config)});`,
  ].join("\n");
}
