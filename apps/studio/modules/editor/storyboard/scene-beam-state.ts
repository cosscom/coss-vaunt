import type { GenerationStatus } from "./generation-stream";
import type { BeamState } from "@/modules/border-beam/border-beam-engine";

/** How long a scene that just finished keeps its green ring before it fades. */
export const SUCCESS_GLOW_MS = 1800;

/** The beam around a scene card: orbiting while the agent works on it, green for a moment once it's done. */
export function sceneBeamState(status: GenerationStatus | undefined, justFinished: boolean): BeamState {
  if (status === "exploring" || status === "recording") return "active";
  if (status === "done" && justFinished) return "success";
  return "idle";
}
