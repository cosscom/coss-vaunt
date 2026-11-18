import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RouteCatalogueEntry } from "../catalogues/routes/route-catalogue";
import type { Action } from "../storyboard/storyboard-schema";
import { canonicalJson, fnv1a64 } from "./capture-hash";
import { normalisePrompt, type TimedChunk } from "./scripted-reply";

/** The real agent's reply to each message a clip sends, as it streamed, kept so every take replays the same answer. */
export type AgentReplies = {
  route: string;
  messages: string[];
  title: string | null;
  turns: TimedChunk[][];
  capturedAt: string;
};

export type AgentConversation = { route: string; messages: string[] };

/** The agent's real wait before it starts answering, capped so it doesn't eat a short scene. */
const MAX_LEAD_MS = 900;
/** Longer pauses mid-reply (a slow tool) shrink to this; the rhythm of the stream is kept below it. */
const MAX_GAP_MS = 450;

/** The chat composer on a route, when the route has one. */
function composerSelector(entry: RouteCatalogueEntry | null): string | null {
  return entry?.targets.find((target) => target.name === "composer")?.selector ?? null;
}

/**
 * The messages a clip types into the agent's composer, after those of the clips it continues, in order; null when
 * it sends none. The conversation belongs to the page the first of those clips opens on.
 */
export function agentConversation(
  steps: ReadonlyArray<{ route: string; actions: readonly Action[]; entry: RouteCatalogueEntry | null }>
): AgentConversation | null {
  const messages: string[] = [];
  for (const { actions, entry } of steps) {
    const composer = composerSelector(entry);
    if (!composer) continue;
    for (const action of actions) {
      if (action.kind === "type" && action.target === composer && action.text.trim())
        messages.push(action.text);
    }
  }
  const first = steps[0];
  return first && messages.length > 0 ? { route: first.route, messages } : null;
}

/** Stable for the same page and messages, whatever their case, spacing or punctuation. */
export function conversationKey({ route, messages }: AgentConversation): string {
  return fnv1a64(canonicalJson({ route, messages: messages.map(normalisePrompt) }));
}

/** A captured reply retimed to play well in a short scene: same chunks and order, long waits shortened. */
export function paceReply(chunks: readonly TimedChunk[]): TimedChunk[] {
  let previous = 0;
  let paced = 0;
  return chunks.map(({ atMs, chunk }, index) => {
    const gap = atMs - previous;
    previous = atMs;
    paced += index === 0 ? Math.min(gap, MAX_LEAD_MS) : Math.min(gap, MAX_GAP_MS);
    return { atMs: Math.round(paced), chunk };
  });
}

function repliesFile(projectDir: string, conversation: AgentConversation): string {
  return path.join(projectDir, "agent-replies", `${conversationKey(conversation)}.json`);
}

export async function readAgentReplies(
  projectDir: string,
  conversation: AgentConversation
): Promise<AgentReplies | null> {
  try {
    return JSON.parse(await readFile(repliesFile(projectDir, conversation), "utf8")) as AgentReplies;
  } catch {
    return null;
  }
}

export async function writeAgentReplies(projectDir: string, replies: AgentReplies): Promise<void> {
  const file = repliesFile(projectDir, replies);
  await mkdir(path.dirname(file), { recursive: true });
  const partial = `${file}.${process.pid}.tmp`;
  await writeFile(partial, `${JSON.stringify(replies, null, 2)}\n`);
  await rename(partial, file);
}
