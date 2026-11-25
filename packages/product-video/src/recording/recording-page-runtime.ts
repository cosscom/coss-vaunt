/// <reference lib="dom" />
import { chatUserMessages, type PageReply, type ReplyEvent, replyKey } from "./app-replies";
import { classifyRequest, fakeTrpcResponse } from "./request-fakes";

type StudioRequests = {
  classify: typeof classifyRequest;
  fakeTrpc: typeof fakeTrpcResponse;
  chatMessages: typeof chatUserMessages;
  replyKey: typeof replyKey;
};

export type RecordingPageConfig = {
  seed: number;
  /** CSS added to every page: hides the OS cursor, the caret and dev overlays. */
  css: string;
  /**
   * Chat messages the page sends get the app's real reply: a saved one replays on the page clock, and a new one goes
   * to the app once, reported to `window.__vauntReply` as it streams, and replays once `deliverReply` hands it back.
   * Null fakes chat messages like any other write.
   */
  replies: PageReply[] | null;
};

/** Marks a chat request on its way to the app, so the recorder doesn't wait on it between frames; the page runtime spells it out. */
export const LIVE_REPLY_HEADER = "x-vaunt-live-reply";

export type PageRect = { x: number; y: number; width: number; height: number };

/** What the recorder calls on `window.__studio` once per frame. */
export type RecordingPageApi = {
  stepAnimations(): void;
  settle(): Promise<void>;
  rectOf(selector: string): PageRect | null;
  /** Scrolls an element that's in the page but off screen to the middle of the view; false when there's nothing to do. */
  reveal(selector: string): boolean;
  /** Chat messages waiting for the app's first reply; page time must not move while any are. */
  liveReplies(): number;
  /** Hands a newly captured reply to the message waiting for it, and keeps it for the rest of the run. */
  deliverReply(reply: PageReply): void;
  /** When each replayed reply finishes streaming, in page time. */
  replyEnds(): number[];
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
 * over module scope. Page timers are Playwright’s fake clock, so animations follow page time.
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
  const requests = (globalThis as unknown as { __studioRequests: StudioRequests }).__studioRequests;
  /** What the page tried to write, for a look in DevTools: `window.__studioFaked`. */
  const faked: Array<{ kind: string; method: string; url: string }> = [];
  (window as unknown as { __studioFaked: typeof faked }).__studioFaked = faked;
  const replies = new Map((config.replies ?? []).map((reply) => [reply.key, reply]));
  const waiting = new Map<string, Array<(reply: PageReply) => void>>();
  const replyEnds: number[] = [];
  let liveReplies = 0;
  const report = (event: ReplyEvent) =>
    (window as unknown as { __vauntReply?: (event: ReplyEvent) => Promise<void> }).__vauntReply?.(event);
  const replay = (reply: PageReply): Response => {
    const encoder = new TextEncoder();
    const endMs = reply.chunks.at(-1)?.atMs ?? 0;
    replyEnds.push(performance.now() + endMs);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const { atMs, text } of reply.chunks) {
          setTimeout(() => controller.enqueue(encoder.encode(text)), atMs);
        }
        setTimeout(() => controller.close(), endMs + 1);
      },
    });
    return new Response(stream, { status: reply.status, headers: reply.headers });
  };
  /** Sends a message the app hasn't answered before and replays its reply once the recorder has saved it. */
  const askApp = (
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    key: string,
    messages: string[]
  ) => {
    liveReplies++;
    const answered = new Promise<Response>((resolve) => {
      waiting.set(key, [...(waiting.get(key) ?? []), (reply) => resolve(replay(reply))]);
    });
    if ((waiting.get(key)?.length ?? 0) > 1) return answered;
    void report({ type: "start", key, messages });
    const request = input instanceof Request ? input : null;
    const headers = new Headers(init?.headers ?? request?.headers ?? undefined);
    headers.set("x-vaunt-live-reply", "1");
    const sent = request
      ? originalFetch.call(window, new Request(request, { ...init, headers }))
      : originalFetch.call(window, input, { ...init, headers });
    sent
      .then(async (response) => {
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, name) => {
          responseHeaders[name] = value;
        });
        void report({ type: "response", key, status: response.status, headers: responseHeaders });
        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            if (text) void report({ type: "chunk", key, text });
          }
          const tail = decoder.decode();
          if (tail) void report({ type: "chunk", key, text: tail });
        }
        void report({ type: "end", key });
      })
      .catch((error: unknown) => {
        void report({ type: "error", key, message: error instanceof Error ? error.message : String(error) });
      });
    return answered;
  };

  const bodyOf = (init: RequestInit | undefined, request: Request | null): Promise<string> => {
    if (typeof init?.body === "string") return Promise.resolve(init.body);
    return request ? request.clone().text() : Promise.resolve("");
  };

  window.fetch = function scriptedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input), location.href);
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    if (config.replies && method === "POST" && url.origin === location.origin) {
      return bodyOf(init, request).then((body) => {
        const messages = requests.chatMessages(body);
        if (!messages) return fakeOrSend(input, init, request, url, method);
        const key = requests.replyKey(url.pathname, messages);
        const saved = replies.get(key);
        return saved ? replay(saved) : askApp(input, init, key, messages);
      });
    }
    return fakeOrSend(input, init, request, url, method);
  };

  function fakeOrSend(
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    request: Request | null,
    url: URL,
    method: string
  ): Promise<Response> {
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
      return bodyOf(init, request).then((body) => json(requests.fakeTrpc({ body, batch, calls })));
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
  }

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
    liveReplies: () => liveReplies,
    deliverReply(reply) {
      replies.set(reply.key, reply);
      const resolvers = waiting.get(reply.key) ?? [];
      waiting.delete(reply.key);
      liveReplies -= resolvers.length;
      for (const resolve of resolvers) resolve(reply);
    },
    replyEnds: () => [...replyEnds],
  };
  (window as unknown as { __studio: RecordingPageApi }).__studio = api;
}

/** The init script source; tsx compiles with keepNames, so `__name` must exist before the function runs. */
export function recordingRuntimeScript(config: RecordingPageConfig): string {
  return [
    "globalThis.__name ??= (target) => target;",
    `globalThis.__studioRequests = { classify: (${classifyRequest.toString()}), fakeTrpc: (${fakeTrpcResponse.toString()}), chatMessages: (${chatUserMessages.toString()}), replyKey: (${replyKey.toString()}) };`,
    `(${installObserverGate.toString()})();`,
    `(${installRecordingRuntime.toString()})(${JSON.stringify(config)});`,
  ].join("\n");
}
