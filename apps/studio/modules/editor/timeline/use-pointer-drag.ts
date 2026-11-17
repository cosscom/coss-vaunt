"use client";

import type * as React from "react";
import { useEffect, useRef } from "react";
import { autoscrollStep } from "./edge-autoscroll";
import { TRACK_HEADER_WIDTH_PX } from "./timeline-metrics";

type DragHandlers = {
  onMove: (move: DragMove) => void;
  /** `moved` is false for a plain click. */
  onEnd: (moved: boolean) => void;
  onCancel: () => void;
};

const DRAG_THRESHOLD_PX = 3;

/** `dx` includes how far the timeline has scrolled since the drag began. */
export type DragMove = { dx: number; clientX: number; clientY: number; shiftKey: boolean };

/**
 * Window-level pointer tracking for a drag that starts on an element; Escape cancels it. Inside the
 * timeline scroller, holding the pointer near a visible edge scrolls the timeline.
 */
export function usePointerDrag(): (event: React.PointerEvent, handlers: DragHandlers) => void {
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRef.current?.(), []);

  return (event, { onMove, onEnd, onCancel }) => {
    if (event.button !== 0) return;
    // A focused field commits on blur; blur it now so it commits at the current playhead, not after a seek.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    event.preventDefault();
    event.stopPropagation();
    stopRef.current?.();
    const scroller =
      event.currentTarget instanceof Element
        ? event.currentTarget.closest<HTMLElement>("[data-timeline-scroller]")
        : null;
    const originX = event.clientX;
    const originY = event.clientY;
    const originScroll = scroller?.scrollLeft ?? 0;
    let pointer = { clientX: originX, clientY: originY, shiftKey: event.shiftKey };
    let moved = false;
    let frame = 0;

    const emit = () => {
      const scrolled = (scroller?.scrollLeft ?? originScroll) - originScroll;
      onMove({ dx: pointer.clientX - originX + scrolled, ...pointer });
    };
    const tick = () => {
      frame = 0;
      if (!scroller) return;
      const box = scroller.getBoundingClientRect();
      const step = autoscrollStep(pointer.clientX, box.left + TRACK_HEADER_WIDTH_PX, box.right);
      if (step === 0) return;
      scroller.scrollLeft += step;
      frame = requestAnimationFrame(tick);
    };
    const move = (next: PointerEvent) => {
      pointer = { clientX: next.clientX, clientY: next.clientY, shiftKey: next.shiftKey };
      if (!moved && Math.hypot(next.clientX - originX, next.clientY - originY) < DRAG_THRESHOLD_PX) return;
      moved = true;
      emit();
      if (!frame) tick();
    };
    const scroll = () => {
      if (moved) emit();
    };
    const up = () => {
      stop();
      onEnd(moved);
    };
    const key = (keyboard: KeyboardEvent) => {
      if (keyboard.key !== "Escape") return;
      stop();
      onCancel();
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      scroller?.removeEventListener("scroll", scroll);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", key);
      stopRef.current = null;
    };
    scroller?.addEventListener("scroll", scroll);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", key);
    stopRef.current = stop;
  };
}
