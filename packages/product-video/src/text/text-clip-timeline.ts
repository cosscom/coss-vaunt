import type { TextEffect } from "../catalogues/text-effects/text-effect";

export type TextPhase =
  | { kind: "enter"; effect: TextEffect; elapsedMs: number }
  | { kind: "exit"; effect: TextEffect; elapsedMs: number }
  | { kind: "rest"; effect: TextEffect | undefined };

export type TextClipTimelineInput = {
  effectIn: TextEffect | undefined;
  /** Length of the whole enter, last unit included, at showcase speed. */
  enterTotalMs: number;
  effectOut: TextEffect | undefined;
  exitTotalMs: number;
  localTimeMs: number;
  clipDurationMs: number;
};

/**
 * The enter starts at 0 and the exit ends at the clip's end. When the clip is shorter than both together,
 * both play proportionally faster so they meet without overlapping.
 */
export function textPhaseAt(input: TextClipTimelineInput): TextPhase {
  const enterMs = input.effectIn ? input.enterTotalMs : 0;
  const exitMs = input.effectOut ? input.exitTotalMs : 0;
  const speed = Math.max(1, (enterMs + exitMs) / input.clipDurationMs);
  const time = input.localTimeMs;
  if (input.effectIn && time < enterMs / speed) {
    return { kind: "enter", effect: input.effectIn, elapsedMs: time * speed };
  }
  const exitStart = input.clipDurationMs - exitMs / speed;
  if (input.effectOut && time >= exitStart) {
    return { kind: "exit", effect: input.effectOut, elapsedMs: (time - exitStart) * speed };
  }
  return { kind: "rest", effect: input.effectIn ?? input.effectOut };
}
