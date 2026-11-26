import { type AgentMessage, parseAgentThread } from "@coss/vaunt-engine/ai/agent-thread";

/** Where threads were kept before they moved beside the project; read once to move them over. */
export const legacyThreadKey = (projectId: string) => `studio.agent-thread.v2.${projectId}`;

const threadUrl = (projectId: string) => `/api/projects/${encodeURIComponent(projectId)}/agent/thread`;

type Storage = Pick<globalThis.Storage, "getItem" | "removeItem">;
type Fetch = typeof fetch;

/** Saves the project's thread beside it; throws when the studio didn't take it. */
export async function saveThread(
  projectId: string,
  messages: readonly AgentMessage[],
  fetchImpl: Fetch = fetch
): Promise<void> {
  const response = await fetchImpl(threadUrl(projectId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!response.ok) throw new Error(`Couldn't save the conversation (${response.status})`);
}

/**
 * The project's saved thread. A thread still in this browser's localStorage moves to the project the first time,
 * when the project has none of its own yet; once the project has one, the old copy is dropped. Throws when the
 * studio can't be reached, so a failed load never gets saved over the real thread.
 */
export async function loadThread(
  projectId: string,
  { fetchImpl = fetch, storage }: { fetchImpl?: Fetch; storage?: Storage } = {}
): Promise<AgentMessage[]> {
  const response = await fetchImpl(threadUrl(projectId), { cache: "no-store" });
  if (!response.ok) throw new Error(`Couldn't load the conversation (${response.status})`);
  const saved = parseAgentThread(((await response.json()) as { messages?: unknown }).messages);
  const key = legacyThreadKey(projectId);
  const legacy = storage?.getItem(key);
  if (legacy == null) return saved;
  if (saved.length > 0) {
    storage?.removeItem(key);
    return saved;
  }
  let local: AgentMessage[] = [];
  try {
    local = parseAgentThread(JSON.parse(legacy));
  } catch {
    // A broken old copy has nothing worth moving.
  }
  if (local.length > 0) await saveThread(projectId, local, fetchImpl);
  storage?.removeItem(key);
  return local;
}
