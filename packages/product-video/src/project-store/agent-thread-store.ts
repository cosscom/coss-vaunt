import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { type AgentMessage, parseAgentThread } from "../ai/agent-thread";

/** The agent conversation, kept beside the project like `app-login.json`, so it travels with the project folder. */
export const AGENT_THREAD_FILE = "agent-thread.json";

/** The project's saved conversation with the agent; empty when there's none yet. */
export async function readAgentThread(projectDir: string): Promise<AgentMessage[]> {
  try {
    return parseAgentThread(JSON.parse(await readFile(path.join(projectDir, AGENT_THREAD_FILE), "utf8")));
  } catch (error) {
    if (error instanceof SyntaxError) return [];
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

/** Saves the conversation, replacing the old one in one step so a crash never leaves half a file. */
export async function writeAgentThread(
  projectDir: string,
  messages: readonly AgentMessage[]
): Promise<AgentMessage[]> {
  const thread = parseAgentThread(messages);
  await mkdir(projectDir, { recursive: true });
  const target = path.join(projectDir, AGENT_THREAD_FILE);
  const temp = `${target}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(thread)}\n`, "utf8");
  await rename(temp, target);
  return thread;
}
