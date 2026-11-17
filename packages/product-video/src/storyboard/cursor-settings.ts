import type { Clip, CursorSettings } from "./storyboard-schema";

export const DEFAULT_CURSOR: CursorSettings = { visible: true, size: 1, style: "arrow" };

/** A recording clip's cursor settings; other clips draw no cursor. */
export function resolveCursorSettings(clip: Pick<Clip, "source">): CursorSettings | null {
  if (clip.source.kind !== "recording") return null;
  return clip.source.cursor ?? DEFAULT_CURSOR;
}

export function setCursorSettings(clip: Clip, change: Partial<CursorSettings>): Clip {
  if (clip.source.kind !== "recording") return clip;
  const cursor = { ...(clip.source.cursor ?? DEFAULT_CURSOR), ...change };
  return { ...clip, source: { ...clip.source, cursor } };
}
