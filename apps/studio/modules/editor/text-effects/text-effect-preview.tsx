"use client";

import type { TextEffect } from "@coss/vaunt-engine/catalogues/text-effects/text-effect";
import { textEffectTotalsMs } from "@coss/vaunt-engine/text/evaluate-text-effect";
import * as React from "react";
import { TextClipLayer } from "../stage/text/text-clip-layer";
import { previewLoopTime } from "./preview-loop";

const PREVIEW_TYPOGRAPHY = { fontSize: 20, lineHeight: 1.15, color: "currentColor", maxWidth: 256 };

/** Loops one effect on the given words; restarts whenever the effect changes. */
export function TextEffectPreview({
  effect,
  text,
}: {
  effect: TextEffect | undefined;
  text: string;
}): React.ReactElement {
  const [elapsedMs, setElapsedMs] = React.useState(0);

  React.useEffect(() => {
    setElapsedMs(0);
    if (!effect) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      setElapsedMs(now - start);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [effect]);

  const loop = effect
    ? previewLoopTime(elapsedMs, textEffectTotalsMs({ text, effectIn: effect, effectOut: effect }))
    : null;
  return (
    <div className="flex h-20 items-center justify-center overflow-hidden">
      {!effect || loop ? (
        <TextClipLayer
          align="center"
          clipDuration={loop?.clipDuration ?? 1}
          effectIn={effect}
          effectOut={effect}
          localTime={loop?.localTime ?? 0}
          size="title"
          text={text}
          typography={PREVIEW_TYPOGRAPHY}
          weight={600}
        />
      ) : null}
    </div>
  );
}
