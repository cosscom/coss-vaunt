"use client";

import {
  NumberField,
  NumberFieldGroup,
  NumberFieldInput,
  NumberFieldScrubArea,
} from "@coss/ui/components/number-field";
import { Slider } from "@coss/ui/components/slider";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { INSPECTOR_ROW_GRID } from "./inspector-row";
import type { KeyframeState } from "./keyframe-state";
import { KeyframeToggle } from "./keyframe-toggle";

type InspectorNumberRowProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  /** Narrower than min–max where the full range is rarely useful on a slider; `null` hides the slider. */
  sliderRange?: [number, number] | null;
  /** Shown in the slider's place when there is no slider. */
  hint?: React.ReactNode;
  format?: Intl.NumberFormatOptions;
  disabled?: boolean;
  keyframe?: { state: KeyframeState; onToggle: () => void };
};

export function InspectorNumberRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
  sliderRange = [min, max],
  hint,
  format,
  disabled,
  keyframe,
}: InspectorNumberRowProps): React.ReactElement {
  return (
    <NumberField
      className={cn(INSPECTOR_ROW_GRID, "gap-y-0")}
      disabled={disabled}
      format={format}
      max={max}
      min={min}
      onValueChange={(next) => next !== null && next !== value && onChange(next)}
      size="sm"
      step={step}
      value={value}>
      <NumberFieldScrubArea
        className="min-w-0 *:data-[slot=label]:truncate *:data-[slot=label]:font-normal *:data-[slot=label]:text-muted-foreground *:data-[slot=label]:text-xs"
        label={label}
      />
      {sliderRange && sliderRange[1] > sliderRange[0] ? (
        <Slider
          aria-label={label}
          className="*:data-[slot=slider-control]:min-w-0"
          disabled={disabled}
          max={sliderRange[1]}
          min={sliderRange[0]}
          onValueChange={(next) => onChange(Array.isArray(next) ? (next[0] ?? value) : next)}
          step={step}
          value={Math.min(sliderRange[1], Math.max(sliderRange[0], value))}
        />
      ) : (
        <span className="truncate text-end text-muted-foreground text-xs">{hint}</span>
      )}
      <NumberFieldGroup>
        <NumberFieldInput aria-label={label} className="px-2 text-end tabular-nums" />
      </NumberFieldGroup>
      {keyframe ? (
        <KeyframeToggle label={label} onToggle={keyframe.onToggle} state={keyframe.state} />
      ) : (
        <span />
      )}
    </NumberField>
  );
}
