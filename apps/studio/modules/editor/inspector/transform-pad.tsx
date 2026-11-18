"use client";

import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useId, useRef, useState } from "react";
import { AxisRow } from "./axis-row";
import type { KeyframeState } from "./keyframe-state";
import {
  clipRect,
  dragPosition,
  dragScale,
  PAD_MARGIN,
  type PadFrame,
  type PadZone,
  type Point,
  padFrame,
  padZone,
  type Transform,
  type TransformKey,
  transformNudge,
} from "./transform-pad-geometry";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.inspector.transformPad;
const KEYS: TransformKey[] = ["x", "y", "scale"];
const THIRDS = [1 / 3, 2 / 3];
const CORNERS = ["top-left", "top-right", "bottom-right", "bottom-left"] as const;

type Drag = { zone: PadZone; start: Point; startTransform: Transform; last: Transform };

function padPoint(event: React.PointerEvent<SVGSVGElement>, size: { width: number; height: number }): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * size.width,
    y: ((event.clientY - rect.top) / rect.height) * size.height,
  };
}

function usePadDrag(
  frame: PadFrame,
  size: { width: number; height: number },
  transform: Transform,
  onChange: TransformPadProps["onChange"]
) {
  const drag = useRef<Drag | null>(null);
  const [activeZone, setActiveZone] = useState<PadZone | null>(null);

  const emit = (next: Partial<Transform>) => {
    const current = drag.current;
    if (!current) return;
    for (const key of KEYS) {
      const value = next[key];
      if (value === undefined || value === current.last[key]) continue;
      current.last = { ...current.last, [key]: value };
      onChange(key, value);
    }
  };
  const endDrag = () => {
    drag.current = null;
    setActiveZone(null);
  };

  return {
    activeZone,
    onPointerDown: (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return;
      const start = padPoint(event, size);
      event.preventDefault();
      // Focus stays off the pad so playhead keys still move the playhead after a drag, as on the sphere.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      event.currentTarget.setPointerCapture(event.pointerId);
      const zone = padZone(frame, transform, start);
      drag.current = { zone, start, startTransform: transform, last: transform };
      setActiveZone(zone);
    },
    onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => {
      const current = drag.current;
      if (!current) return;
      const point = padPoint(event, size);
      if (current.zone === "scale") {
        emit({ scale: dragScale(frame, current.startTransform, current.start, point) });
        return;
      }
      const delta = { x: point.x - current.start.x, y: point.y - current.start.y };
      emit(dragPosition(frame, current.startTransform, delta, event.shiftKey));
    },
    onPointerUp: endDrag,
    onLostPointerCapture: endDrag,
  };
}

export type TransformPadProps = Transform & {
  /** Output width over height, so the pad's frame has the video's shape. */
  aspect: number;
  keyframes: Record<TransformKey, KeyframeState>;
  onChange: (key: TransformKey, value: number) => void;
  onToggleKeyframe: (key: TransformKey) => void;
  onReset: () => void;
};

/**
 * The output frame with the clip drawn where it sits: drag the clip to move it (Shift for one axis), drag a
 * corner to scale it about its centre. The values beside it key like any other property.
 */
export function TransformPad({
  x,
  y,
  scale,
  aspect,
  keyframes,
  onChange,
  onToggleKeyframe,
  onReset,
}: TransformPadProps): React.ReactElement {
  const instructionsId = useId();
  const clipPathId = `pad${useId().replace(/[^\w-]/g, "")}`;
  const transform = { x, y, scale };
  const frame = padFrame(aspect);
  const size = { width: frame.width + PAD_MARGIN * 2, height: frame.height + PAD_MARGIN * 2 };
  const clip = clipRect(frame, transform);
  const { activeZone, ...pointerHandlers } = usePadDrag(frame, size, transform, onChange);

  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const nudge = transformNudge(event.code, event.shiftKey, transform);
    if (!nudge) return;
    event.preventDefault();
    if (nudge.value !== transform[nudge.key]) onChange(nudge.key, nudge.value);
  };

  return (
    <div className="flex items-center gap-3 [--studio-accent:var(--info)]">
      <svg
        aria-describedby={instructionsId}
        aria-label={copy.label}
        aria-roledescription={copy.roleDescription}
        aria-valuetext={copy.valueText(x, y, scale)}
        className={cn(
          "min-w-0 max-w-44 flex-1 touch-none select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          activeZone === "scale" ? "cursor-nwse-resize" : activeZone ? "cursor-grabbing" : "cursor-grab"
        )}
        data-testid="transform-pad"
        onDoubleClick={onReset}
        onKeyDown={onKeyDown}
        role="application"
        tabIndex={0}
        viewBox={`0 0 ${size.width} ${size.height}`}
        {...pointerHandlers}>
        <defs>
          <clipPath id={clipPathId}>
            <rect height={size.height} rx={8} width={size.width} />
          </clipPath>
        </defs>
        <rect
          className={cn(
            "fill-foreground/4 stroke-border transition-colors hover:fill-foreground/7",
            activeZone && "fill-foreground/7"
          )}
          height={size.height - 1}
          rx={8}
          width={size.width - 1}
          x={0.5}
          y={0.5}
        />
        <g className="pointer-events-none" clipPath={`url(#${clipPathId})`}>
          <rect
            className="fill-background stroke-border dark:fill-black/40"
            height={frame.height}
            width={frame.width}
            x={frame.left}
            y={frame.top}
          />
          {THIRDS.map((at) => (
            <g className="stroke-foreground/14" key={at} strokeDasharray="1.5 3">
              <line
                x1={frame.left + frame.width * at}
                x2={frame.left + frame.width * at}
                y1={frame.top}
                y2={frame.top + frame.height}
              />
              <line
                x1={frame.left}
                x2={frame.left + frame.width}
                y1={frame.top + frame.height * at}
                y2={frame.top + frame.height * at}
              />
            </g>
          ))}
          <rect
            className="fill-(--studio-accent)/10 stroke-(--studio-accent)"
            height={clip.height}
            rx={2}
            strokeWidth={1.5}
            width={clip.width}
            x={clip.left}
            y={clip.top}
          />
          {clip.corners.map((corner, index) => (
            <rect
              className={cn(
                "fill-foreground stroke-background",
                activeZone === "scale" && "fill-(--studio-accent)"
              )}
              height={6}
              key={CORNERS[index]}
              strokeWidth={1.5}
              width={6}
              x={corner.x - 3}
              y={corner.y - 3}
            />
          ))}
          <circle
            className="fill-(--studio-accent) stroke-background"
            cx={clip.centre.x}
            cy={clip.centre.y}
            r={5.5}
            strokeWidth={2}
          />
        </g>
      </svg>
      <span className="sr-only" id={instructionsId}>
        {copy.instructions}
      </span>
      <div className="flex shrink-0 flex-col gap-1.5">
        {KEYS.map((key) => (
          <AxisRow
            className="grid-cols-[2.25rem_4.5rem_1.75rem]"
            key={key}
            keyframe={keyframes[key]}
            label={copy.axes[key]}
            onChange={(value) => onChange(key, value)}
            onToggleKeyframe={() => onToggleKeyframe(key)}
            propertyKey={key}
            value={transform[key]}
          />
        ))}
      </div>
    </div>
  );
}
