import type { AgentMessage } from "@coss/vaunt-engine/ai/agent-thread";
import { describe, expect, it } from "vitest";
import { legacyThreadKey, loadThread } from "./thread-storage";

const THREAD: AgentMessage[] = [{ id: "1", role: "user", content: "Make a launch video" }];

/** A studio that holds one saved thread, and records what was saved. */
function studio(messages: AgentMessage[], { ok = true } = {}) {
  const puts: unknown[] = [];
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      puts.push(JSON.parse(String(init.body)));
      return new Response("{}");
    }
    return ok ? Response.json({ messages }) : new Response("nope", { status: 500 });
  }) as typeof fetch;
  return { fetchImpl, puts };
}

function storage(value: string | null) {
  const items = new Map(value === null ? [] : [[legacyThreadKey("p"), value]]);
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    removeItem: (key: string) => void items.delete(key),
  };
}

describe("loadThread", () => {
  it("reads the thread saved with the project", async () => {
    const { fetchImpl, puts } = studio(THREAD);
    expect(await loadThread("p", { fetchImpl, storage: storage(null) })).toEqual(THREAD);
    expect(puts).toEqual([]);
  });

  it("moves a thread from localStorage to the project once", async () => {
    const { fetchImpl, puts } = studio([]);
    const local = storage(JSON.stringify(THREAD));
    expect(await loadThread("p", { fetchImpl, storage: local })).toEqual(THREAD);
    expect(puts).toEqual([{ messages: THREAD }]);
    expect(local.items.size).toBe(0);
  });

  it("keeps the project's thread over an old local one, and drops the local copy", async () => {
    const saved: AgentMessage[] = [{ id: "2", role: "user", content: "Newer" }];
    const { fetchImpl, puts } = studio(saved);
    const local = storage(JSON.stringify(THREAD));
    expect(await loadThread("p", { fetchImpl, storage: local })).toEqual(saved);
    expect(puts).toEqual([]);
    expect(local.items.size).toBe(0);
  });

  it("throws when the studio can't be reached, leaving the local copy", async () => {
    const { fetchImpl } = studio([], { ok: false });
    const local = storage(JSON.stringify(THREAD));
    await expect(loadThread("p", { fetchImpl, storage: local })).rejects.toThrow("Couldn't load");
    expect(local.items.size).toBe(1);
  });
});
