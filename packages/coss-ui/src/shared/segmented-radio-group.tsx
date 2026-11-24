"use client";

import { RadioGroupPrimitive, RadioPrimitive } from "@coss/ui/components/radio-group";
import {
  SegmentedControl,
  SegmentedControlItem,
  type SegmentedControlSize,
} from "@coss/ui/components/segmented-control";
import type * as React from "react";

export function SegmentedRadioGroup({
  className,
  size = "default",
  children,
  ...props
}: Omit<RadioGroupPrimitive.Props, "className"> & {
  className?: string;
  size?: SegmentedControlSize;
}): React.ReactElement {
  return (
    <SegmentedControl
      className={className}
      render={<RadioGroupPrimitive data-slot="segmented-radio-group" {...props} />}
      size={size}>
      {children}
    </SegmentedControl>
  );
}

export function SegmentedRadio({
  className,
  size,
  ...props
}: Omit<RadioPrimitive.Root.Props, "className"> & {
  className?: string;
  size?: SegmentedControlSize;
}): React.ReactElement {
  return (
    <SegmentedControlItem
      className={className}
      render={<RadioPrimitive.Root data-slot="segmented-radio" {...props} />}
      size={size}
    />
  );
}
