"use client";

import { cn } from "@coss/ui/lib/utils";
import type { CubicPoints } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type * as React from "react";
import { useId, useRef } from "react";
import {
  curvePath,
  fromPointer,
  type HandleIndex,
  handleOnPlot,
  holdPath,
  moveHandle,
  nudgeHandle,
  PLOT_VIEW_BOX,
  type PlotPoint,
  toPlot,
} from "./curve-plot";
import { EASING_COPY as copy } from "./easing-copy";

type CurveEditorProps = {
  /** Null draws a hold step without handles. */
  points: CubicPoints | null;
  disabled: boolean;
  /** Where the preview dot sits on the curve, in curve space. */
  preview: PlotPoint | null;
  /** `group` is shared by every change of one drag so it undoes in one step. */
  onChange: (points: CubicPoints, group?: string) => void;
};

const GRID = [0.25, 0.5, 0.75];
const START = toPlot(0, 0);
const END = toPlot(1, 1);
const format = (value: number) => String(Math.round(value * 100) / 100);

function PlotGrid(): React.ReactElement {
  return (
    <>
      <rect
        className="fill-muted/40 stroke-border"
        height={START.y - END.y}
        vectorEffect="non-scaling-stroke"
        width={END.x - START.x}
        x={START.x}
        y={END.y}
      />
      {GRID.map((value) => {
        const vertical = toPlot(value, 0);
        const horizontal = toPlot(0, value);
        return (
          <g className="stroke-border" key={value}>
            <line vectorEffect="non-scaling-stroke" x1={vertical.x} x2={vertical.x} y1={END.y} y2={START.y} />
            <line
              vectorEffect="non-scaling-stroke"
              x1={START.x}
              x2={END.x}
              y1={horizontal.y}
              y2={horizontal.y}
            />
          </g>
        );
      })}
      <line
        className="stroke-muted-foreground/40"
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
        x1={START.x}
        x2={END.x}
        y1={START.y}
        y2={END.y}
      />
    </>
  );
}

type CurveHandleProps = {
  index: HandleIndex;
  x: number;
  y: number;
  disabled: boolean;
  descriptionId: string;
  onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => void;
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
};

function CurveHandle({ index, x, y, disabled, descriptionId, onKeyDown, onPointerDown }: CurveHandleProps) {
  const plot = handleOnPlot(x, y);
  return (
    <g
      aria-describedby={descriptionId}
      aria-disabled={disabled || undefined}
      aria-label={copy.handle(index === 0 ? 1 : 2, format(x), format(y))}
      aria-valuemax={2}
      aria-valuemin={-1}
      aria-valuenow={y}
      aria-valuetext={`${format(x)}, ${format(y)}`}
      className={cn("group/handle outline-none", disabled ? "pointer-events-none" : "cursor-grab")}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      role="slider"
      tabIndex={disabled ? -1 : 0}>
      <circle className="fill-transparent" cx={plot.x} cy={plot.y} r={9} />
      <circle
        className="fill-info/24 opacity-0 transition-opacity group-hover/handle:opacity-100 group-focus-visible/handle:opacity-100"
        cx={plot.x}
        cy={plot.y}
        r={7}
      />
      <circle
        className={cn(
          "stroke-info group-focus-visible/handle:stroke-foreground",
          plot.offScale ? "fill-background" : "fill-info"
        )}
        cx={plot.x}
        cy={plot.y}
        r={4}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

export function CurveEditor({ points, disabled, preview, onChange }: CurveEditorProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ handle: HandleIndex; group: string } | null>(null);
  const descriptionId = useId();

  const onPointerMove = (event: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!drag.current || !svg || !points) return;
    const target = fromPointer(event.clientX, event.clientY, svg.getBoundingClientRect());
    onChange(moveHandle(points, drag.current.handle, target, event.shiftKey), drag.current.group);
  };

  const handles = points
    ? ([0, 1] as const).map((index) => ({ index, x: points[index * 2], y: points[index * 2 + 1] }))
    : [];
  const previewPlot = preview ? toPlot(preview.x, preview.y) : null;

  return (
    <div className="flex flex-col gap-1">
      <div className="relative mx-auto w-full max-w-44">
        <svg
          aria-label={copy.graph}
          className={cn("block w-full touch-none select-none overflow-visible", disabled && "opacity-48")}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
          onPointerMove={onPointerMove}
          ref={svgRef}
          role="group"
          viewBox={PLOT_VIEW_BOX}>
          <PlotGrid />
          {handles.map(({ index, x, y }) => {
            const plot = handleOnPlot(x, y);
            const anchor = index === 0 ? START : END;
            return (
              <line
                className="stroke-info/72"
                key={index}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                x1={anchor.x}
                x2={plot.x}
                y1={anchor.y}
                y2={plot.y}
              />
            );
          })}
          <path
            className="fill-none stroke-foreground"
            d={points ? curvePath(points) : holdPath()}
            strokeLinecap="round"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          {previewPlot ? (
            <circle className="fill-foreground" cx={previewPlot.x} cy={previewPlot.y} r={2.5} />
          ) : null}
          {handles.map(({ index, x, y }) => (
            <CurveHandle
              descriptionId={descriptionId}
              disabled={disabled}
              index={index}
              key={index}
              onKeyDown={(event) => {
                if (!points) return;
                const next = nudgeHandle(points, index, event.key, event.shiftKey);
                if (!next) return;
                event.preventDefault();
                onChange(next);
              }}
              onPointerDown={(event) => {
                if (event.button !== 0 || !svgRef.current) return;
                event.preventDefault();
                event.currentTarget.focus();
                svgRef.current.setPointerCapture(event.pointerId);
                drag.current = { handle: index, group: `easing:${event.timeStamp}` };
              }}
              x={x}
              y={y}
            />
          ))}
        </svg>
        <span className="pointer-events-none absolute top-[calc(83.33%+0.125rem)] right-[8.33%] text-[0.625rem] text-muted-foreground/72">
          {copy.time}
        </span>
        <span className="pointer-events-none absolute top-[16.67%] left-[4.17%] origin-center -translate-x-1/2 translate-y-[calc(50%+1rem)] -rotate-90 text-[0.625rem] text-muted-foreground/72">
          {copy.progress}
        </span>
      </div>
      <p className="sr-only" id={descriptionId}>
        {copy.handleDescription}
      </p>
    </div>
  );
}
