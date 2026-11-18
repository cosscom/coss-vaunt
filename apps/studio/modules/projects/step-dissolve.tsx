"use client";

import type * as React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { STEP_DISSOLVE_MS, stepDissolveFrame } from "./step-dissolve-frame";

const FOCUS_TARGET = "[data-step-focus], input:not([type=hidden]), textarea";

/**
 * Shows `render(step)`; when `step` changes, stacks the old and new step and dissolves between them while the
 * height eases to the new step's. Frames are written straight to the elements, so typing never re-renders them.
 */
export function StepDissolve({
  step,
  render,
}: {
  step: number;
  render: (step: number) => React.ReactNode;
}): React.ReactElement {
  const [layers, setLayers] = useState([step]);
  const [shown, setShown] = useState(step);
  const stage = useRef<HTMLDivElement>(null);
  const elements = useRef(new Map<number, HTMLDivElement>());
  const cancelRunning = useRef<(() => void) | null>(null);

  if (step !== shown) {
    setShown(step);
    setLayers([shown, step]);
  }

  useLayoutEffect(() => {
    if (layers.length < 2) return;
    cancelRunning.current?.();
    const [from, to] = layers;
    const leaving = elements.current.get(from);
    const entering = elements.current.get(to);
    const box = stage.current;
    if (!leaving || !entering || !box) return;

    const startHeight = leaving.offsetHeight;
    const endHeight = entering.offsetHeight;
    leaving.inert = true;
    entering.inert = false;
    leaving.style.display = entering.style.display = "";
    box.style.overflow = "hidden";

    const apply = (t: number) => {
      const frame = stepDissolveFrame(t);
      box.style.height = `${startHeight + (endHeight - startHeight) * frame.height}px`;
      for (const [element, state] of [
        [leaving, frame.leaving],
        [entering, frame.entering],
      ] as const) {
        element.style.opacity = String(state.opacity);
        element.style.filter = state.blur > 0.05 ? `blur(${state.blur}px)` : "";
        element.style.transform = `scale(${state.scale})`;
      }
    };

    let request = 0;
    const finish = () => {
      cancelAnimationFrame(request);
      cancelRunning.current = null;
      // Hidden, not reset: React unmounts it a frame later, and a reset would paint it once over the new step.
      leaving.style.display = "none";
      entering.style.opacity = entering.style.filter = entering.style.transform = "";
      box.style.height = box.style.overflow = "";
      setLayers([to]);
      if (!window.matchMedia("(pointer: coarse)").matches)
        entering.querySelector<HTMLElement>(FOCUS_TARGET)?.focus({ preventScroll: true });
    };
    cancelRunning.current = () => cancelAnimationFrame(request);

    apply(0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / STEP_DISSOLVE_MS);
      apply(t);
      if (t < 1) request = requestAnimationFrame(tick);
      else finish();
    };
    request = requestAnimationFrame(tick);
  }, [layers]);

  return (
    <div className="grid" ref={stage}>
      {layers.map((layer) => (
        <div
          className="col-start-1 row-start-1 self-start"
          key={layer}
          ref={(element) => {
            if (element) elements.current.set(layer, element);
            else elements.current.delete(layer);
          }}>
          {render(layer)}
        </div>
      ))}
    </div>
  );
}
