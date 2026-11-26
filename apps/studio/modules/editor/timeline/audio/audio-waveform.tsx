"use client";

import { type WaveformPeaks, waveformColumns } from "@coss/vaunt-engine/audio/waveform-peaks";
import type { AudioClip } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { useTheme } from "next-themes";
import type * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PlaybackClock } from "../../player/playback-clock";
import { useHeaderWidth } from "../track-header-width";
import { visibleSpan } from "./visible-span";
import { volumeCurvePoints } from "./volume-curve";

type AudioWaveformProps = {
  clip: AudioClip;
  peaks: WaveformPeaks | null;
  width: number;
  height: number;
  pxPerSecond: number;
  clock: PlaybackClock;
};

function scrollParentOf(element: HTMLElement): HTMLElement | null {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const { overflowX } = getComputedStyle(parent);
    if (overflowX === "auto" || overflowX === "scroll") return parent;
  }
  return null;
}

/** The clip's pixels the timeline's scroll viewport shows, beside the sticky track headers. */
function useVisiblePixels(ref: React.RefObject<HTMLElement | null>, width: number): [number, number] | null {
  const [span, setSpan] = useState<[number, number] | null>(null);
  const headerWidth = useHeaderWidth();
  useLayoutEffect(() => {
    const element = ref.current;
    const scroller = element ? scrollParentOf(element) : null;
    if (!element || !scroller) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const view = scroller.getBoundingClientRect();
      const next = visibleSpan(
        element.getBoundingClientRect().left,
        width,
        view.left + headerWidth,
        view.right
      );
      setSpan((current) => (current?.[0] === next?.[0] && current?.[1] === next?.[1] ? current : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    scroller.addEventListener("scroll", schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(scroller);
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", schedule);
      observer.disconnect();
    };
  }, [ref, width, headerWidth]);
  return span;
}

/** Mirrored bars in device pixels, one bar and one gap wide each, so they stay crisp at any DPR. */
function drawBars(
  canvas: HTMLCanvasElement,
  peaks: WaveformPeaks,
  fromSeconds: number,
  cssWidth: number,
  cssHeight: number,
  pxPerSecond: number,
  color: string
) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;
  const bar = Math.max(1, Math.round(dpr));
  const step = bar * 2;
  const count = Math.ceil(canvas.width / step);
  const columns = waveformColumns(peaks, fromSeconds, step / dpr / pxPerSecond, count);
  const middle = canvas.height / 2;
  for (let index = 0; index < count; index++) {
    const amplitude = Math.max(columns[index * 2 + 1] ?? 0, -(columns[index * 2] ?? 0));
    const half = Math.max(bar / 2, Math.round(amplitude * middle * 0.92));
    context.fillRect(index * step, Math.round(middle - half), bar, Math.max(bar, half * 2));
  }
}

/**
 * The clip's waveform, drawn only for its visible part: dim, with a brighter copy revealed up to the
 * playhead, and the volume curve (volume × fades) as a line over it.
 */
export function AudioWaveform({
  clip,
  peaks,
  width,
  height,
  pxPerSecond,
  clock,
}: AudioWaveformProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLCanvasElement>(null);
  const brightRef = useRef<HTMLCanvasElement>(null);
  const span = useVisiblePixels(ref, width);
  const { resolvedTheme } = useTheme();
  const from = span?.[0] ?? 0;
  const spanWidth = span ? span[1] - span[0] : 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: the colour is read from CSS, which the theme changes.
  useEffect(() => {
    const element = ref.current;
    if (!element || !peaks || spanWidth === 0) return;
    const color = getComputedStyle(element).getPropertyValue("--studio-audio").trim() || "rebeccapurple";
    const fromSeconds = clip.trimStart + from / pxPerSecond;
    for (const canvas of [dimRef.current, brightRef.current]) {
      if (canvas) drawBars(canvas, peaks, fromSeconds, spanWidth, height, pxPerSecond, color);
    }
  }, [peaks, from, spanWidth, height, pxPerSecond, clip.trimStart, resolvedTheme]);

  useEffect(() => {
    const reveal = () => {
      const canvas = brightRef.current;
      if (!canvas) return;
      const played = (clock.getState().time - clip.start) * pxPerSecond - from;
      const hidden = Math.min(spanWidth, Math.max(0, spanWidth - played));
      canvas.style.clipPath = `inset(0 ${hidden}px 0 0)`;
    };
    reveal();
    return clock.subscribe(reveal);
  }, [clock, clip.start, pxPerSecond, from, spanWidth]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" ref={ref}>
      {span ? (
        <div className="absolute inset-y-0" style={{ left: from, width: spanWidth }}>
          <canvas className="absolute inset-0 size-full opacity-72" ref={dimRef} />
          <canvas className="absolute inset-0 size-full brightness-125" ref={brightRef} />
          <svg
            className="absolute inset-0 size-full overflow-visible"
            data-testid="audio-volume-curve"
            viewBox={`0 0 ${spanWidth} ${height}`}>
            <polyline
              className="fill-none stroke-(--studio-audio-line)"
              points={volumeCurvePoints(clip, from, from + spanWidth, pxPerSecond, height)}
              strokeLinejoin="round"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      ) : null}
    </div>
  );
}
