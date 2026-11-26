"use client";

import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useEffect, useId, useRef } from "react";
import { barEnvelope, type PlayWaveConfig, playWaveEasing } from "./play-wave-config";
import type { PlayWaveSampler } from "./play-wave-samplers";

type PlayWaveButtonProps = {
  config: PlayWaveConfig;
  playing: boolean;
  onToggle: () => void;
  /** Read every frame while open, so the bars follow the playhead without re-rendering. */
  getTime: () => number;
  sample: PlayWaveSampler;
  label: string;
  disabled?: boolean;
  className?: string;
  testId?: string;
};

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A solid play triangle with rounded corners: the stroke rounds the corners, so the points are pulled in by it. */
function PlayTriangle({ config }: { config: PlayWaveConfig }): React.ReactElement {
  const height = config.size * config.triangleScale;
  const width = height * 0.9;
  const r = config.triangleRadius;
  const points = [
    [r, r],
    [r, height - r],
    [width - r * 1.2, height / 2],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
  return (
    <svg
      aria-hidden="true"
      className="overflow-visible"
      height={height}
      style={{ transform: `translateX(${config.triangleOffset}px)` }}
      viewBox={`0 0 ${width} ${height}`}
      width={width}>
      <polygon
        fill="currentColor"
        points={points}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={r * 2}
      />
    </svg>
  );
}

/** Two rounded bars the triangle's height, so play and pause read as one glyph changing. */
function PauseGlyph({ config }: { config: PlayWaveConfig }): React.ReactElement {
  const height = config.size * config.triangleScale;
  const bar = Math.max(2, height * 0.26);
  return (
    <span aria-hidden="true" className="flex items-center" style={{ gap: bar * 0.8 }}>
      <span className="rounded-full bg-current" style={{ width: bar, height }} />
      <span className="rounded-full bg-current" style={{ width: bar, height }} />
    </span>
  );
}

/**
 * Play, as a solid triangle on the secondary button's tone. Pressed, the button opens to the left and turns clear:
 * the glyph rides its right edge and becomes pause, and the media's waveform around the playhead grows out of the
 * middle of the space it leaves. Pressed again, it all folds back. One spring drives both directions.
 */
export function PlayWaveButton({
  config,
  playing,
  onToggle,
  getTime,
  sample,
  label,
  disabled,
  className,
  testId,
}: PlayWaveButtonProps): React.ReactElement {
  // useId can hold characters a url(#…) reference would need escaped; CSS.escape doesn't exist on the server.
  const gradientId = `play-wave-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const bars = useRef<(SVGRectElement | null)[]>([]);
  const live = useRef({ getTime, sample, config });
  live.current = { getTime, sample, config };
  const reduced = prefersReducedMotion();
  const easing = playWaveEasing(config);
  const duration = reduced ? 0 : playing ? config.openMs : config.closeMs;
  // The waveform takes the pill less the glyph's circle at its right end.
  const waveWidth = Math.max(0, config.width - config.size);
  const inset = config.size * 0.4;
  const innerWidth = Math.max(0, waveWidth - inset);
  const spacing = config.bars > 1 ? innerWidth / (config.bars - 1) : 0;
  const half = (config.bars - 1) / 2;

  // The bars' heights follow the media every frame while open, and a little after closing.
  useEffect(() => {
    let frame = 0;
    const stopAt = playing ? Number.POSITIVE_INFINITY : performance.now() + config.closeMs + 100;
    const draw = (now: number) => {
      const { getTime: time, sample: amplitudeAt, config: current } = live.current;
      const center = time();
      const step = current.bars > 1 ? current.window / (current.bars - 1) : 0;
      const middle = (current.bars - 1) / 2;
      for (let index = 0; index < current.bars; index++) {
        const rect = bars.current[index];
        if (!rect) continue;
        const loud =
          amplitudeAt(center + (index - middle) * step, step) *
          barEnvelope(index, current.bars, current.focus);
        const height = Math.max(current.dotSize, loud * current.amplitude * current.size);
        rect.setAttribute("height", height.toFixed(2));
        rect.setAttribute("y", ((current.size - height) / 2).toFixed(2));
      }
      if (now < stopAt) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [playing, config.closeMs]);

  const fill = config.palette === "gradient" ? `url(#${gradientId})` : "currentColor";
  const glyphTransition = (shown: boolean) =>
    reduced
      ? "none"
      : `opacity ${duration * 0.6}ms ease-out ${shown ? duration * 0.15 : 0}ms, transform ${duration}ms ${easing}, filter ${duration * 0.6}ms ease-out`;

  return (
    <button
      aria-label={label}
      aria-pressed={playing}
      className={cn(
        "group/play relative isolate shrink-0 overflow-hidden rounded-full text-secondary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.96] disabled:pointer-events-none disabled:opacity-48",
        playing ? "bg-transparent hover:bg-secondary/48" : "bg-secondary hover:bg-secondary/80",
        className
      )}
      data-playing={playing ? "" : undefined}
      data-testid={testId}
      disabled={disabled}
      onClick={onToggle}
      style={{
        width: playing ? config.width : config.size,
        height: config.size,
        transition: reduced
          ? "none"
          : `width ${duration}ms ${easing}, background-color ${duration * 0.7}ms ease-out, scale 150ms ease-out`,
      }}
      type="button">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 overflow-visible"
        height={config.size}
        viewBox={`0 0 ${waveWidth} ${config.size}`}
        width={waveWidth}>
        <defs>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={gradientId}
            x1={inset}
            x2={waveWidth}
            y1="0"
            y2="0">
            <stop offset="0" style={{ stopColor: "var(--info)" }} />
            <stop offset="1" style={{ stopColor: "var(--studio-audio)" }} />
          </linearGradient>
        </defs>
        {Array.from({ length: config.bars }, (_, index) => {
          const distance = Math.abs(index - half);
          const delay = reduced
            ? 0
            : playing
              ? distance * config.stagger
              : (half - distance) * config.stagger * 0.4;
          const x = inset + index * spacing - config.barWidth / 2;
          return (
            <g
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed slots, never reordered
              key={index}
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                transform: playing ? "scaleY(1)" : "scaleY(0)",
                opacity: playing ? 1 : 0,
                transition: reduced
                  ? "none"
                  : `transform ${config.barMs}ms ${easing} ${delay}ms, opacity ${config.barMs * 0.6}ms ease-out ${delay}ms`,
              }}>
              <rect
                fill={fill}
                height={config.dotSize}
                ref={(element) => {
                  bars.current[index] = element;
                }}
                rx={config.barWidth / 2}
                width={config.barWidth}
                x={x}
                y={(config.size - config.dotSize) / 2}
              />
            </g>
          );
        })}
      </svg>
      {/* The glyph's circle sits at the right end: centred while closed, carried right by the opening width. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 flex items-center justify-center"
        style={{ width: config.size, height: config.size }}>
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{
            opacity: playing ? 0 : 1,
            transform: playing ? "scale(0.5) rotate(-90deg)" : "scale(1) rotate(0deg)",
            filter: playing ? "blur(1.5px)" : "blur(0px)",
            transition: glyphTransition(!playing),
          }}>
          <PlayTriangle config={config} />
        </span>
        <span
          className="absolute inset-0 flex items-center justify-center text-foreground"
          style={{
            opacity: playing ? 1 : 0,
            transform: playing ? "scale(1) rotate(0deg)" : "scale(0.5) rotate(90deg)",
            filter: playing ? "blur(0px)" : "blur(1.5px)",
            transition: glyphTransition(playing),
          }}>
          <PauseGlyph config={config} />
        </span>
      </span>
    </button>
  );
}
