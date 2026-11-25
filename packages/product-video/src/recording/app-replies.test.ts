import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type AppReply,
  chatUserMessages,
  createReplyRecorder,
  type PageReply,
  paceChunks,
  readAppReplies,
  replayableHeaders,
  replyKey,
  writeAppReply,
} from "./app-replies";

describe("chatUserMessages", () => {
  it("reads the user turns of an AI SDK chat request", () => {
    const body = JSON.stringify({
      sessionUid: "abc",
      messages: [
        { role: "user", parts: [{ type: "text", text: "show me my bookings" }] },
        { role: "assistant", parts: [{ type: "text", text: "Here they are" }] },
        { role: "user", parts: [{ type: "step-start" }, { type: "text", text: "Very cool, thank you!" }] },
      ],
    });
    expect(chatUserMessages(body)).toEqual(["show me my bookings", "Very cool, thank you!"]);
  });

  it("reads OpenAI-style content", () => {
    const body = JSON.stringify({
      messages: [
        { role: "system", content: "Be brief" },
        { role: "user", content: "hello" },
        { role: "user", content: [{ type: "text", text: "again" }] },
      ],
    });
    expect(chatUserMessages(body)).toEqual(["hello", "again"]);
  });

  it("leaves other writes alone", () => {
    expect(chatUserMessages(JSON.stringify({ "0": { json: { title: "30 min" } } }))).toBeNull();
    expect(chatUserMessages(JSON.stringify({ messages: [{ role: "assistant", content: "hi" }] }))).toBeNull();
    expect(chatUserMessages("name=Sandy")).toBeNull();
    expect(chatUserMessages("")).toBeNull();
  });
});

describe("replyKey", () => {
  it("ignores case, spacing and punctuation but not the endpoint", () => {
    expect(replyKey("/api/ai/chat", ["Show me my bookings!"])).toBe(
      replyKey("/api/ai/chat", ["show me  my bookings"])
    );
    expect(replyKey("/api/ai/chat", ["hi"])).not.toBe(replyKey("/api/other", ["hi"]));
    expect(replyKey("/api/ai/chat", ["hi", "there"])).not.toBe(replyKey("/api/ai/chat", ["hi there"]));
  });
});

describe("paceChunks", () => {
  it("shortens the wait before the reply and long pauses within it", () => {
    const paced = paceChunks([
      { atMs: 11_000, text: "a" },
      { atMs: 11_040, text: "b" },
      { atMs: 14_000, text: "c" },
    ]);
    expect(paced.map((chunk) => chunk.atMs)).toEqual([900, 940, 1390]);
    expect(paced.map((chunk) => chunk.text).join("")).toBe("abc");
  });

  it("speeds up a long stream so it fits a short scene", () => {
    const chunks = Array.from({ length: 101 }, (_, index) => ({ atMs: 500 + index * 100, text: `${index}` }));
    const paced = paceChunks(chunks);
    expect(paced[0]?.atMs).toBe(500);
    expect(paced.at(-1)?.atMs).toBe(3500);
    expect(paced.every((chunk, index) => index === 0 || chunk.atMs >= (paced[index - 1]?.atMs ?? 0))).toBe(
      true
    );
  });
});

describe("replayableHeaders", () => {
  it("keeps what describes the stream and drops what a rebuilt body can't carry", () => {
    expect(
      replayableHeaders({
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
        "Content-Length": "120",
        "content-encoding": "gzip",
        "set-cookie": "a=b",
      })
    ).toEqual({ "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" });
  });
});

describe("saved replies", () => {
  let dir: string | null = null;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = null;
  });

  it("round-trips through the project folder", async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "app-replies-"));
    expect(await readAppReplies(dir)).toEqual([]);
    const reply: AppReply = {
      key: replyKey("/api/ai/chat", ["hi"]),
      messages: ["hi"],
      status: 200,
      headers: { "content-type": "text/event-stream" },
      chunks: [{ atMs: 10, text: "data: {}\n\n" }],
      capturedAt: "2026-11-25T00:00:00.000Z",
    };
    await writeAppReply(dir, reply);
    await writeAppReply(dir, reply);
    expect(await readAppReplies(dir)).toEqual([reply]);
  });
});

describe("createReplyRecorder", () => {
  const setup = (projectDir: string | null = null) => {
    let clock = 1000;
    const delivered: PageReply[] = [];
    const recorder = createReplyRecorder({
      projectDir,
      deliver: async (reply) => {
        delivered.push(reply);
      },
      now: () => clock,
    });
    return {
      recorder,
      delivered,
      advance: (ms: number) => {
        clock += ms;
      },
    };
  };

  it("times the stream, saves the reply and hands it back paced", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "app-replies-"));
    try {
      const { recorder, delivered, advance } = setup(dir);
      await recorder.onEvent({ type: "start", key: "k", messages: ["show me my bookings"] });
      advance(11_000);
      await recorder.onEvent({
        type: "response",
        key: "k",
        status: 200,
        headers: { "content-type": "text/event-stream", "content-length": "9" },
      });
      await recorder.onEvent({ type: "chunk", key: "k", text: "data: 1\n\n" });
      advance(50);
      await recorder.onEvent({ type: "chunk", key: "k", text: "data: 2\n\n" });
      await recorder.onEvent({ type: "end", key: "k" });

      expect(recorder.failure()).toBeNull();
      expect(delivered).toEqual([
        {
          key: "k",
          status: 200,
          headers: { "content-type": "text/event-stream" },
          chunks: [
            { atMs: 900, text: "data: 1\n\n" },
            { atMs: 950, text: "data: 2\n\n" },
          ],
        },
      ]);
      const [saved] = await readAppReplies(dir);
      expect(saved?.messages).toEqual(["show me my bookings"]);
      expect(saved?.chunks.map((chunk) => chunk.atMs)).toEqual([11_000, 11_050]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("fails with the message the app couldn't answer", async () => {
    const { recorder, delivered } = setup();
    await recorder.onEvent({ type: "start", key: "k", messages: ["hi", "show me my bookings"] });
    await recorder.onEvent({ type: "response", key: "k", status: 500, headers: {} });
    await recorder.onEvent({ type: "chunk", key: "k", text: "Internal error" });
    await recorder.onEvent({ type: "end", key: "k" });
    expect(recorder.failure()).toBe(
      'The app couldn\'t answer "show me my bookings": HTTP 500 Internal error'
    );
    expect(delivered).toEqual([]);
  });

  it("fails on an empty reply or a dropped request", async () => {
    const empty = setup();
    await empty.recorder.onEvent({ type: "start", key: "k", messages: ["hi"] });
    await empty.recorder.onEvent({ type: "response", key: "k", status: 200, headers: {} });
    await empty.recorder.onEvent({ type: "end", key: "k" });
    expect(empty.recorder.failure()).toBe('The app couldn\'t answer "hi": the reply was empty');

    const dropped = setup();
    await dropped.recorder.onEvent({ type: "start", key: "k", messages: ["hi"] });
    await dropped.recorder.onEvent({ type: "error", key: "k", message: "Failed to fetch" });
    expect(dropped.recorder.failure()).toBe('The app couldn\'t answer "hi": Failed to fetch');
  });
});
