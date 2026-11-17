"use client";

import {
  EASE_DIRECTIONS,
  EASE_PRESETS,
  type EaseDirection,
  findEasePreset,
} from "@calcom/product-video/storyboard/ease-presets";
import { easeToCubic, sameCurve } from "@calcom/product-video/storyboard/keyframe-ease";
import type { Ease } from "@calcom/product-video/storyboard/storyboard-schema";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { cn } from "@coss/ui/lib/utils";
import { SegmentedRadio, SegmentedRadioGroup } from "@coss/ui/shared/segmented-radio-group";
import type * as React from "react";
import { useState } from "react";
import { curvePath, holdPath } from "./curve-plot";
import { EASING_COPY as copy, easeLabel } from "./easing-copy";

type EasePresetGridProps = {
  /** The first selected keyframe's ease; it opens its preset's tab and, unless mixed, reads as active. */
  ease: Ease;
  mixed: boolean;
  disabled: boolean;
  onPick: (ease: Ease) => void;
};

const isDirection = (value: unknown): value is EaseDirection =>
  EASE_DIRECTIONS.some((direction) => direction === value);

function directionOf(ease: Ease): EaseDirection {
  const cubic = easeToCubic(ease);
  return (cubic && findEasePreset(cubic)?.direction) || "in-out";
}

function PresetButton({
  ease,
  active,
  disabled,
  onPick,
}: {
  ease: Ease;
  active: boolean;
  disabled: boolean;
  onPick: (ease: Ease) => void;
}): React.ReactElement {
  const cubic = easeToCubic(ease);
  const label = easeLabel(ease);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            aria-label={label}
            aria-pressed={active}
            className={cn(
              "flex h-9 cursor-pointer items-center justify-center rounded-md border border-transparent text-muted-foreground outline-none transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-48",
              active && "border-border bg-accent text-foreground"
            )}
            disabled={disabled}
            onClick={() => onPick(ease)}
            type="button"
          />
        }>
        <svg aria-hidden="true" className="h-7 w-6 overflow-visible" viewBox="-5 15 110 120">
          <path
            className="fill-none stroke-current"
            d={cubic ? curvePath(cubic) : holdPath()}
            strokeLinecap="round"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

export function EasePresetGrid({ ease, mixed, disabled, onPick }: EasePresetGridProps): React.ReactElement {
  const [direction, setDirection] = useState<EaseDirection>(() => directionOf(ease));
  const choices: Ease[] = [
    "linear",
    "hold",
    ...EASE_PRESETS.filter((preset) => preset.direction === direction).map((preset) => ({
      cubic: preset.cubic,
    })),
  ];

  return (
    <div className="flex flex-col gap-2">
      <SegmentedRadioGroup
        aria-label={copy.presets}
        className="w-full"
        disabled={disabled}
        onValueChange={(value) => {
          if (isDirection(value)) setDirection(value);
        }}
        size="sm"
        value={direction}>
        {EASE_DIRECTIONS.map((option) => (
          <SegmentedRadio className="flex-1" key={option} value={option}>
            {copy.directions[option]}
          </SegmentedRadio>
        ))}
      </SegmentedRadioGroup>
      <div className="grid grid-cols-5 gap-1">
        {choices.map((choice) => (
          <PresetButton
            active={!disabled && !mixed && sameCurve(choice, ease)}
            disabled={disabled}
            ease={choice}
            key={typeof choice === "string" ? choice : choice.cubic.join(",")}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}
