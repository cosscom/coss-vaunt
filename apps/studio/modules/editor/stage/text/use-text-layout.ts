"use client";

import type { TextLayoutMeasurements } from "@calcom/product-video/text/evaluate-text-effect";
import * as React from "react";
import { groupWordsIntoLines } from "./measured-lines";

/**
 * Reads line breaks and word sizes from a hidden copy of the text laid out with the same typography, for
 * per-line and kinetic effects. `layoutKey` must change whenever anything that affects layout changes.
 */
export function useTextLayout(
  enabled: boolean,
  layoutKey: string
): { measureRef: React.RefObject<HTMLDivElement | null>; measurements: TextLayoutMeasurements | undefined } {
  const measureRef = React.useRef<HTMLDivElement | null>(null);
  const [measurements, setMeasurements] = React.useState<TextLayoutMeasurements | undefined>(undefined);

  // biome-ignore lint/correctness/useExhaustiveDependencies: layoutKey stands in for the typography the DOM reads
  React.useLayoutEffect(() => {
    const element = measureRef.current;
    if (!enabled || !element) {
      setMeasurements(undefined);
      return;
    }
    const measure = (): void => {
      const words = Array.from(element.querySelectorAll<HTMLElement>("[data-word]"));
      setMeasurements({
        lines: groupWordsIntoLines(
          words.map((word) => ({ text: word.textContent ?? "", top: word.offsetTop }))
        ),
        wordSizes: words.map((word) => ({ width: word.offsetWidth, height: word.offsetHeight })),
      });
    };
    measure();
    document.fonts.addEventListener("loadingdone", measure);
    return () => document.fonts.removeEventListener("loadingdone", measure);
  }, [enabled, layoutKey]);

  return { measureRef, measurements };
}
