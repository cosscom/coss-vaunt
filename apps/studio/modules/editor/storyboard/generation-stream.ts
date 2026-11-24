import { type Clip, clipSchema } from "@coss/vaunt-engine/storyboard/storyboard-schema";

export const GENERATION_STATUSES = ["queued", "exploring", "recording", "done", "failed"] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

export type NodeGenerationEvent = {
  nodeId: string;
  status: GenerationStatus;
  message?: string;
  progress?: number;
  clips?: Clip[];
};
export type GenerationEvent = NodeGenerationEvent | { done: true };
/** What a node card shows while its board generates; `steps` are the agent's messages so far, oldest first. */
export type NodeGeneration = Pick<NodeGenerationEvent, "status" | "message" | "progress"> & {
  steps?: string[];
};

const SHOWN_STEPS = 3;

function isStatus(value: unknown): value is GenerationStatus {
  return GENERATION_STATUSES.some((status) => status === value);
}

function toEvent(value: unknown): GenerationEvent | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (record.done === true) return { done: true };
  const { nodeId, status, message, progress, clips } = record;
  if (typeof nodeId !== "string" || nodeId === "" || !isStatus(status)) return null;
  const parsedClips = clips === undefined ? undefined : clipSchema.array().safeParse(clips);
  if (parsedClips && !parsedClips.success) return null;
  return {
    nodeId,
    status,
    ...(typeof message === "string" ? { message } : {}),
    ...(typeof progress === "number" ? { progress } : {}),
    ...(parsedClips ? { clips: parsedClips.data } : {}),
  };
}

function parseEvent(block: string): GenerationEvent | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n");
  if (!data) return null;
  try {
    return toEvent(JSON.parse(data));
  } catch {
    return null;
  }
}

/**
 * Complete server-sent events in `buffer`, and the unfinished tail to prepend to the next chunk. Events that
 * aren't valid JSON of the contract's shape are skipped rather than ending the stream.
 */
export function parseGenerationStream(buffer: string): { events: GenerationEvent[]; rest: string } {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? "";
  return {
    events: blocks.map(parseEvent).filter((event): event is GenerationEvent => event !== null),
    rest,
  };
}

export function isDoneEvent(event: GenerationEvent): event is { done: true } {
  return "done" in event;
}

/** Node statuses after an event; clips are applied to the project separately. */
export function applyGenerationEvent(
  statuses: Record<string, NodeGeneration>,
  event: NodeGenerationEvent
): Record<string, NodeGeneration> {
  const { nodeId, status, message, progress } = event;
  const earlier = status === "queued" ? [] : (statuses[nodeId]?.steps ?? []);
  const steps = message && earlier.at(-1) !== message ? [...earlier, message] : earlier;
  return { ...statuses, [nodeId]: { status, message, progress, ...(steps.length > 0 ? { steps } : {}) } };
}

/** The node card's task list while it works: the last few finished steps, and the one in progress. */
export function shownSteps(generation: NodeGeneration): { finished: string[]; current: string | null } {
  const steps = generation.steps ?? [];
  if (generation.status !== "exploring" && generation.status !== "recording")
    return { finished: [], current: null };
  return { finished: steps.slice(-SHOWN_STEPS, -1), current: steps.at(-1) ?? null };
}

/** Every node still waiting or working when the stream ends without finishing it. */
export function failUnfinished(
  statuses: Record<string, NodeGeneration>,
  message: string
): Record<string, NodeGeneration> {
  return Object.fromEntries(
    Object.entries(statuses).map(([nodeId, generation]) => [
      nodeId,
      generation.status === "done" || generation.status === "failed"
        ? generation
        : { status: "failed", message },
    ])
  );
}
