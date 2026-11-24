"use client";

import { cn } from "@coss/ui/lib/utils";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";

type AgentMorphLoaderProps = {
  className?: string;
};

// Eight frames sampled from the reference; each index identifies a cell in the 3 × 3 grid.
const FRAMES = [
  [1, 3, 4, 5, 6, 8],
  [1, 2, 4, 5, 6],
  [2, 4, 5, 7],
  [2, 5, 6, 7],
  [3, 5, 6, 8],
  [0, 3, 7, 8],
  [0, 3, 4, 7],
  [0, 1, 3, 4, 8],
];

export function AgentMorphLoader({ className }: AgentMorphLoaderProps): ReactElement {
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = (): void => setReduceMotion(preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  return (
    <svg
      aria-hidden="true"
      className={cn("size-3.5 shrink-0 fill-current", className)}
      data-slot="agent-morph-loader"
      viewBox="6 6 28 28">
      {Array.from({ length: 9 }, (_, index) => {
        return (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: each dot occupies a fixed grid cell
            key={index}
            cx={12 + (index % 3) * 8}
            cy={12 + Math.floor(index / 3) * 8}
            r={2}
            opacity={Number(FRAMES[0].includes(index))}>
            {!reduceMotion && (
              <animate
                attributeName="opacity"
                calcMode="discrete"
                dur="1.4s"
                repeatCount="indefinite"
                values={FRAMES.map((dots) => Number(dots.includes(index))).join(";")}
              />
            )}
          </circle>
        );
      })}
    </svg>
  );
}

export type { AgentMorphLoaderProps };
