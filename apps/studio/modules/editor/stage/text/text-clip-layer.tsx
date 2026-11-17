"use client";

import type { TextEffect } from "@calcom/product-video/catalogues/text-effects/text-effect";
import type { TEXT_SIZES } from "@calcom/product-video/storyboard/storyboard-schema";
import { evaluateTextEffect, SHOWCASE_FONT_PX } from "@calcom/product-video/text/evaluate-text-effect";
import type * as React from "react";
import { TextEffectFrameView } from "./text-effect-frame-view";
import type { TextTypography } from "./text-typography";
import { useTextLayout } from "./use-text-layout";

export type TextClipLayerProps = {
  text: string;
  effectIn: TextEffect | undefined;
  effectOut: TextEffect | undefined;
  localTime: number;
  clipDuration: number;
  typography: TextTypography;
  weight: number;
  align: "start" | "center" | "end";
  size: (typeof TEXT_SIZES)[number];
};

const needsLayout = (effect: TextEffect | undefined): boolean =>
  effect !== undefined && (effect.target === "per-line" || effect.renderer.id.startsWith("kinetic"));

/** One text clip as live Cal Sans, the effect evaluated at the clip's local time. */
export function TextClipLayer(props: TextClipLayerProps): React.ReactElement {
  const { text, typography, weight, align, size } = props;
  const textStyle: React.CSSProperties = {
    fontFamily: "var(--font-heading), var(--font-sans), sans-serif",
    fontOpticalSizing: "auto",
    fontWeight: weight,
    fontSize: typography.fontSize,
    lineHeight: typography.lineHeight,
    color: typography.color,
    textAlign: align,
    textWrap: size === "body" ? "pretty" : "balance",
    width: typography.maxWidth,
  };
  const layoutKey = [
    text,
    typography.fontSize,
    typography.lineHeight,
    typography.maxWidth,
    weight,
    size,
  ].join("|");
  const measuring = needsLayout(props.effectIn) || needsLayout(props.effectOut);
  const { measureRef, measurements } = useTextLayout(measuring, layoutKey);
  const frame = evaluateTextEffect({
    text,
    effectIn: props.effectIn,
    effectOut: props.effectOut,
    localTime: props.localTime,
    clipDuration: props.clipDuration,
    pxScale: typography.fontSize / SHOWCASE_FONT_PX,
    measurements,
  });

  return (
    <div style={{ ...textStyle, position: "relative" }}>
      <TextEffectFrameView frame={frame} />
      {measuring ? (
        <div
          aria-hidden
          ref={measureRef}
          style={{
            ...textStyle,
            position: "absolute",
            top: 0,
            left: 0,
            visibility: "hidden",
            pointerEvents: "none",
          }}>
          {text
            .split(/\s+/)
            .filter(Boolean)
            .map((word, index) => (
              <span key={index}>
                {index > 0 ? " " : null}
                <span data-word style={{ display: "inline-block", whiteSpace: "pre" }}>
                  {word}
                </span>
              </span>
            ))}
        </div>
      ) : null}
    </div>
  );
}
