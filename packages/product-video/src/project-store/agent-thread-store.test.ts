import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentMessage } from "../ai/agent-thread";
import { EMPTY_BOARD } from "../storyboard/board-schema";
import { AGENT_THREAD_FILE, readAgentThread, writeAgentThread } from "./agent-thread-store";

const THREAD: AgentMessage[] = [
  { id: "1", role: "user", content: "Make a launch video", context: ["Launch"] },
  {
    id: "2",
    role: "assistant",
    content: "Here's a first pass.",
    changes: [
      { id: "c", kind: "board", summary: "Drafted", before: EMPTY_BOARD, rationale: "Why" },
      { id: "t", kind: "theme", summary: "Dark", before: "light", undone: true },
    ],
  },
];

describe("agent thread store", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "agent-thread-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("is empty before anything is saved", async () => {
    expect(await readAgentThread(dir)).toEqual([]);
  });

  it("saves the thread beside the project and reads it back, leaving no temp file", async () => {
    await writeAgentThread(dir, THREAD);
    expect(await readAgentThread(dir)).toEqual(THREAD);
    expect(await readdir(dir)).toEqual([AGENT_THREAD_FILE]);
  });

  it("drops turns that no longer read, and a broken file reads as empty", async () => {
    await writeFile(
      path.join(dir, AGENT_THREAD_FILE),
      JSON.stringify([THREAD[0], { id: "x", role: "robot" }])
    );
    expect(await readAgentThread(dir)).toEqual([THREAD[0]]);
    await writeFile(path.join(dir, AGENT_THREAD_FILE), "{nope");
    expect(await readAgentThread(dir)).toEqual([]);
  });
});
