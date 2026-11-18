"use client";

import { PROPERTY_SPECS, type PropertyKey } from "@calcom/product-video/storyboard/property-specs";
import {
  NumberField,
  NumberFieldGroup,
  NumberFieldInput,
  NumberFieldScrubArea,
} from "@coss/ui/components/number-field";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import type { KeyframeState } from "./keyframe-state";
import { KeyframeToggle } from "./keyframe-toggle";
import { propertyFormat } from "./property-controls";

/** One value beside a visual control (the rotation sphere, the transform pad): short label, field, keyframe toggle. */
export function AxisRow({
  propertyKey,
  label,
  value,
  keyframe,
  onChange,
  onToggleKeyframe,
  disabled,
  className,
}: {
  propertyKey: PropertyKey;
  label: string;
  value: number;
  keyframe: KeyframeState;
  onChange: (value: number) => void;
  onToggleKeyframe: () => void;
  disabled?: boolean;
  /** Sets the label column, e.g. `grid-cols-[2.5rem_4.5rem_1.75rem]` for a word. */
  className?: string;
}): React.ReactElement {
  const spec = PROPERTY_SPECS[propertyKey];
  return (
    <NumberField
      className={cn("grid grid-cols-[0.75rem_4.5rem_1.75rem] items-center gap-x-2 gap-y-0", className)}
      disabled={disabled}
      format={propertyFormat(spec)}
      max={spec.max}
      min={spec.min}
      onValueChange={(next) => next !== null && next !== value && onChange(next)}
      size="sm"
      step={spec.step}
      value={value}>
      <NumberFieldScrubArea
        className="*:data-[slot=label]:font-normal *:data-[slot=label]:text-muted-foreground *:data-[slot=label]:text-xs"
        label={label}
      />
      <NumberFieldGroup>
        <NumberFieldInput
          aria-label={spec.label}
          className="px-2 text-end tabular-nums"
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        />
      </NumberFieldGroup>
      <KeyframeToggle label={spec.label} onToggle={onToggleKeyframe} state={keyframe} />
    </NumberField>
  );
}
