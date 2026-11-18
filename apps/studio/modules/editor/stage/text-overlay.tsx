"use client";

import { getTextEffect } from "@calcom/product-video/catalogues/text-effects/text-effect-catalogue";
import type { Clip } from "@calcom/product-video/storyboard/storyboard-schema";
import type { ActiveClip } from "@calcom/product-video/storyboard/track-resolution";
import type * as React from "react";
import { TextClipLayer } from "./text/text-clip-layer";
import { textClipPlacement } from "./text/text-clip-placement";
import { textTypography } from "./text/text-typography";

export type TextOverlayProps = {
  /** Active text clips at the current time, bottom track first. */
  clips: ActiveClip[];
  /** Output frame size in CSS px of the letterboxed stage, so text scales with the frame. */
  frame: { width: number; height: number };
  /** Text colour, chosen to read on the project background. */
  color: string;
};

type TextSource = Extract<Clip["source"], { kind: "text" }>;
type ActiveTextClip = ActiveClip & { clip: Clip & { source: TextSource } };

const isTextClip = (active: ActiveClip): active is ActiveTextClip => active.clip.source.kind === "text";

/**
 * Text clips as live HTML over the stage canvas, filling the element the stage mounts it in (the letterboxed
 * frame). Everything is a function of each clip's local time, so any frame can be drawn on demand.
 */
export function TextOverlay({ clips, frame, color }: TextOverlayProps): React.ReactElement | null {
  const textClips = clips.filter(isTextClip);
  if (textClips.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {textClips.map((active) => {
        const { source } = active.clip;
        const placement = textClipPlacement(active);
        return (
          <div
            data-stage-clip-id={active.clip.id}
            key={`${active.clip.id}-${active.transition?.role ?? "solo"}`}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              opacity: placement.opacity,
              transform: `translate(-50%, -50%) translate(${placement.x * frame.width}px, ${placement.y * frame.height}px) scale(${placement.scale})`,
            }}>
            <TextClipLayer
              align={source.align}
              clipDuration={active.clip.duration}
              effectIn={source.effectIn ? getTextEffect(source.effectIn) : undefined}
              effectOut={source.effectOut ? getTextEffect(source.effectOut) : undefined}
              localTime={active.localTime}
              size={source.size}
              text={source.text}
              typography={textTypography(source.size, color, frame)}
              weight={source.weight}
            />
          </div>
        );
      })}
    </div>
  );
}
