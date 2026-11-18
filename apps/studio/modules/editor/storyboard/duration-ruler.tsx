"use client";

import { SliderPrimitive } from "@coss/ui/components/slider";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useState } from "react";
import { durationTicks, nearestTick } from "./duration-ticks";

const STEP = 0.5;

/** A slider drawn as a ruler of bars: bars up to the value are lit, and the bar under the pointer lifts. */
export function DurationRuler({
  value,
  min,
  max,
  label,
  onValueChange,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  onValueChange: (value: number) => void;
}): React.ReactElement {
  const ticks = durationTicks(min, max);
  const valueTick = nearestTick(ticks, value);
  const [hoverTick, setHoverTick] = useState<number | null>(null);

  return (
    <SliderPrimitive.Root
      className="w-full"
      max={max}
      min={min}
      onValueChange={(next) => {
        const single = Array.isArray(next) ? next[0] : next;
        if (typeof single === "number") onValueChange(single);
      }}
      step={STEP}
      thumbAlignment="edge"
      value={value}>
      <SliderPrimitive.Control
        className="relative flex h-7 w-full cursor-ew-resize touch-none select-none data-disabled:pointer-events-none"
        onPointerLeave={() => setHoverTick(null)}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const fraction = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
          setHoverTick(nearestTick(ticks, min + fraction * (max - min)));
        }}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-end justify-between">
          {ticks.map((tick, index) => (
            <span
              className={cn(
                "w-0.5 rounded-full transition-[height,background-color] duration-150 ease-out motion-reduce:transition-none",
                tick.major ? "h-3.5" : "h-2",
                index <= valueTick ? "bg-foreground/56" : "bg-muted-foreground/24",
                index === hoverTick && index !== valueTick && "h-5 bg-foreground/80"
              )}
              key={tick.value}
            />
          ))}
        </div>
        <SliderPrimitive.Track className="relative h-full w-full">
          <SliderPrimitive.Thumb
            aria-label={label}
            className="h-full w-0.5 rounded-full bg-foreground outline-none transition-[box-shadow] has-focus-visible:ring-[3px] has-focus-visible:ring-ring/48"
          />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}
