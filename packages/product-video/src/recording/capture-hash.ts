import { type RouteCatalogueEntry, routeEntryFor } from "../catalogues/routes/route-catalogue";
import type { Action, Clip, Project } from "../storyboard/storyboard-schema";
import { captureDpr, MAX_CAPTURE_DPR, MIN_CAPTURE_DPR } from "./capture-dpr";
import { type ReplayStep, replayChain } from "./replay-chain";

/** Bump when the recorder changes what it captures, so old recordings stop matching. */
export const RECORDER_VERSION = 2;

/** Everything that changes a recording's pixels; camera, text and audio edits stay out. */
export type CaptureSpec = {
  recorderVersion: number;
  route: string;
  actions: Action[];
  duration: number;
  fps: number;
  theme: "light" | "dark";
  viewport: { width: number; height: number };
  dpr: number;
  /** The manifest logs this selector's rect per frame. */
  focus: string | null;
  routeEntry: RouteCatalogueEntry;
  /** Recordings replayed before capture, earliest first; absent for a fresh start so older hashes still match. */
  replay?: ReplayStep[];
};

export function captureSpecFor({
  project,
  clip,
  theme = project.settings.theme,
}: {
  project: Pick<Project, "settings"> & Partial<Pick<Project, "videoTracks">>;
  clip: Clip;
  theme?: "light" | "dark";
}): CaptureSpec {
  if (clip.source.kind !== "recording") throw new Error(`Clip "${clip.name}" is not a recording`);
  const routeEntry = routeEntryFor(clip.source.route);
  if (!routeEntry) throw new Error(`Route ${clip.source.route} is not a path in the app`);
  const replay = replayChain(project.videoTracks, clip);
  return {
    recorderVersion: RECORDER_VERSION,
    route: clip.source.route,
    actions: clip.source.actions,
    duration: clip.duration,
    fps: project.settings.fps,
    theme,
    viewport: routeEntry.viewport,
    dpr: captureDpr({ aspectRatio: project.settings.aspectRatio, viewport: routeEntry.viewport, clip }).dpr,
    focus: clip.focus ?? null,
    routeEntry,
    replay: replay.length > 0 ? replay : undefined,
  };
}

/** JSON with object keys sorted, so equal values always serialise the same way. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => Number(a > b) - Number(a < b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const FNV_OFFSET = BigInt("0xcbf29ce484222325");
const FNV_PRIME = BigInt("0x100000001b3");
const MASK_64 = BigInt("0xffffffffffffffff");

/** FNV-1a 64 over UTF-8: the same in the browser and in Node, so the editor finds recordings without a server. */
function fnv1a64(text: string): string {
  let hash = FNV_OFFSET;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
}

/** The parts of a route's entry that reach the page; targets, labels and descriptions only guide planning. */
function pixelInputs(entry: RouteCatalogueEntry) {
  const { hiddenSelectors, viewport, login, timezone, clockTime, replyFixture } = entry;
  return { hiddenSelectors, viewport, login, timezone, clockTime, replyFixture };
}

export function captureHash(spec: CaptureSpec): string {
  return fnv1a64(canonicalJson({ ...spec, routeEntry: pixelInputs(spec.routeEntry) }));
}

export function captureHashForClip(args: Parameters<typeof captureSpecFor>[0]): string {
  return captureHash(captureSpecFor(args));
}

/**
 * The clip's capture hash at every DPR: the one its peak zoom needs, then sharper, then softer. Zooming a
 * clip in raises the DPR it needs, so a take that differs only in DPR stands in until it is re-recorded.
 */
export function captureHashesForClip(args: Parameters<typeof captureSpecFor>[0]): string[] {
  const spec = captureSpecFor(args);
  const sharper = Array.from({ length: MAX_CAPTURE_DPR - spec.dpr }, (_, index) => spec.dpr + index + 1);
  const softer = Array.from({ length: spec.dpr - MIN_CAPTURE_DPR }, (_, index) => spec.dpr - index - 1);
  return [spec.dpr, ...sharper, ...softer].map((dpr) => captureHash({ ...spec, dpr }));
}

/** What the clip captures apart from its DPR: stays put while zoom edits change the DPR it needs. */
export function captureContentKey(args: Parameters<typeof captureSpecFor>[0]): string {
  return captureHash({ ...captureSpecFor(args), dpr: 0 });
}
