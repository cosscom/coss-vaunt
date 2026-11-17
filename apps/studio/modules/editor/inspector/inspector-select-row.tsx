"use client";

import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@coss/ui/components/select";
import type * as React from "react";
import { InspectorRow } from "./inspector-row";

export function InspectorSelectRow<Value extends string | number>({
  label,
  value,
  items,
  onChange,
  disabled,
}: {
  label: string;
  value: Value;
  items: readonly { value: Value; label: string }[];
  onChange: (value: Value) => void;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <InspectorRow label={label}>
      <Select
        disabled={disabled}
        items={items}
        onValueChange={(next) => next !== null && onChange(next)}
        value={value}>
        <SelectTrigger aria-label={label} size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </InspectorRow>
  );
}
