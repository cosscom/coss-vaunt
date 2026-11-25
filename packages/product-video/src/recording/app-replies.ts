import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fnv1a64 } from "./capture-hash";

/** A piece of a reply's body and when it arrived, in ms after the request was sent. */
export type TimedChunk = { atMs: number; text: string };

/**
 * The app's real reply to a chat message a clip sent, as it streamed, saved in the project so every take replays
 * the same answer and the app is asked only once.
 */
export type AppReply = {
  /** The request's path and the user messages it carried; see `replyKey`. */
  key: string;
  messages: string[];
  status: number;
  headers: Record<string, string>;
  chunks: TimedChunk[];
  capturedAt: string;
};

/** What the page replays: the saved reply, paced for a short scene. */
export type PageReply = Pick<AppReply, "key" | "status" | "headers" | "chunks">;

/** What the page reports while the app answers a message for the first time. */
export type ReplyEvent =
  | { type: "start"; key: string; messages: string[] }
  | { type: "response"; key: string; status: number; headers: Record<string, string> }
  | { type: "chunk"; key: string; text: string }
  | { type: "end"; key: string }
  | { type: "error"; key: string; message: string };

/** The app couldn't answer a message: not a fault in the clip's script, so retrying the script won't help. */
export class AppReplyError extends Error {
  override name = "AppReplyError";
}

/**
 * The user messages in a chat request's JSON body, oldest first; null when the body isn't a chat. Reads the AI SDK's
 * `parts` and the OpenAI-style `content`. Serialised into the page with `toString()`: no imports, no closures.
 */
export function chatUserMessages(body: string): string[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  const messages = (parsed as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(messages)) return null;
  const texts: string[] = [];
  for (const message of messages) {
    if (!message || typeof message !== "object" || (message as { role?: unknown }).role !== "user") continue;
    const { parts, content } = message as { parts?: unknown; content?: unknown };
    let pieces: unknown[] = [];
    if (Array.isArray(parts)) pieces = parts;
    else if (Array.isArray(content)) pieces = content;
    let text = typeof content === "string" ? content : "";
    for (const piece of pieces) {
      const { type, text: pieceText } = (piece ?? {}) as { type?: unknown; text?: unknown };
      if (type === "text" && typeof pieceText === "string") text += (text ? " " : "") + pieceText;
    }
    if (text.trim()) texts.push(text.trim());
  }
  return texts.length > 0 ? texts : null;
}

/**
 * The same conversation on the same endpoint, whatever the case, spacing or punctuation of its messages.
 * Serialised into the page with `toString()`.
 */
export function replyKey(pathname: string, messages: readonly string[]): string {
  const normalised = messages.map((text) =>
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
  );
  return `${pathname} ${JSON.stringify(normalised)}`;
}

/** The app's real wait before it starts answering, capped so it doesn't eat a short scene. */
const MAX_LEAD_MS = 900;
/** Longer pauses mid-reply (a slow tool) shrink to this; the rhythm of the stream is kept below it. */
const MAX_GAP_MS = 450;
/** A long reply streams faster rather than running past the scene: recordings are at most 8 s. */
const MAX_STREAM_MS = 3000;

/** A reply retimed to play well in a short scene: same chunks and order, long waits shortened. */
export function paceChunks(chunks: readonly TimedChunk[]): TimedChunk[] {
  let previous = 0;
  let total = 0;
  const shortened = chunks.map((chunk, index) => {
    const gap = Math.max(0, chunk.atMs - previous);
    previous = chunk.atMs;
    total += Math.min(gap, index === 0 ? MAX_LEAD_MS : MAX_GAP_MS);
    return { atMs: total, text: chunk.text };
  });
  const lead = shortened[0]?.atMs ?? 0;
  const stream = total - lead;
  const scale = stream > MAX_STREAM_MS ? MAX_STREAM_MS / stream : 1;
  return shortened.map(({ atMs, text }) => ({ atMs: Math.round(lead + (atMs - lead) * scale), text }));
}

/** Headers a replayed response can't or shouldn't carry: the body is rebuilt, and cookies stay with the app. */
const DROPPED_HEADERS = new Set([
  "content-length",
  "content-encoding",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "set-cookie",
  "date",
]);

export function replayableHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !DROPPED_HEADERS.has(name.toLowerCase()))
  );
}

const REPLIES_DIR = "app-replies";

function replyFile(projectDir: string, key: string): string {
  return path.join(projectDir, REPLIES_DIR, `${fnv1a64(key)}.json`);
}

export async function readAppReplies(projectDir: string): Promise<AppReply[]> {
  const directory = path.join(projectDir, REPLIES_DIR);
  const names = await readdir(directory).catch(() => [] as string[]);
  const replies = await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map((name) =>
        readFile(path.join(directory, name), "utf8")
          .then((content) => JSON.parse(content) as AppReply)
          .catch(() => null)
      )
  );
  return replies.filter((reply): reply is AppReply => reply !== null);
}

export async function writeAppReply(projectDir: string, reply: AppReply): Promise<void> {
  const file = replyFile(projectDir, reply.key);
  await mkdir(path.dirname(file), { recursive: true });
  const partial = `${file}.${process.pid}.tmp`;
  await writeFile(partial, `${JSON.stringify(reply, null, 2)}\n`);
  await rename(partial, file);
}

export function pageReply(reply: AppReply): PageReply {
  return {
    key: reply.key,
    status: reply.status,
    headers: replayableHeaders(reply.headers),
    chunks: paceChunks(reply.chunks),
  };
}

/**
 * Times the app's answers to messages the page sends for the first time, as they stream in real time, saves each
 * one and hands it back to the page to replay on the page clock.
 */
export function createReplyRecorder({
  projectDir,
  deliver,
  now = Date.now,
}: {
  /** Where replies are saved; null keeps them for this run only. */
  projectDir: string | null;
  deliver: (reply: PageReply) => Promise<void>;
  now?: () => number;
}) {
  type Live = Omit<AppReply, "capturedAt"> & { startedAt: number };
  const live = new Map<string, Live>();
  let failure: string | null = null;

  const fail = (entry: Live | undefined, reason: string) => {
    const message = entry?.messages.at(-1);
    failure ??= message
      ? `The app couldn't answer "${message}": ${reason}`
      : `The app couldn't answer: ${reason}`;
  };

  return {
    /** Why a reply couldn't be captured, once one has failed. */
    failure: () => failure,
    async onEvent(event: ReplyEvent): Promise<void> {
      const entry = live.get(event.key);
      switch (event.type) {
        case "start":
          live.set(event.key, {
            key: event.key,
            messages: event.messages,
            status: 0,
            headers: {},
            chunks: [],
            startedAt: now(),
          });
          return;
        case "response":
          if (!entry) return;
          entry.status = event.status;
          entry.headers = event.headers;
          return;
        case "chunk":
          entry?.chunks.push({ atMs: now() - entry.startedAt, text: event.text });
          return;
        case "error":
          live.delete(event.key);
          fail(entry, event.message);
          return;
        case "end": {
          if (!entry) return;
          live.delete(event.key);
          if (entry.status >= 400) {
            const body = entry.chunks
              .map((chunk) => chunk.text)
              .join("")
              .slice(0, 300);
            fail(entry, `HTTP ${entry.status}${body ? ` ${body}` : ""}`);
            return;
          }
          if (entry.chunks.length === 0) {
            fail(entry, "the reply was empty");
            return;
          }
          const { startedAt: _startedAt, ...reply } = entry;
          const saved: AppReply = { ...reply, capturedAt: new Date(now()).toISOString() };
          if (projectDir) await writeAppReply(projectDir, saved);
          await deliver(pageReply(saved));
          return;
        }
      }
    },
  };
}

export type ReplyRecorder = ReturnType<typeof createReplyRecorder>;
