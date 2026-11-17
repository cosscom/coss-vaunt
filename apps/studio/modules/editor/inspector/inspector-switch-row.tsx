"use client";

import { Label } from "@coss/ui/components/label";
import { Switch } from "@coss/ui/components/switch";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { INSPECTOR_ROW_GRID } from "./inspector-row";

/** The whole row is the label, so clicking the text flips the switch. */
export function InspectorSwitchRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}): React.ReactElement {
  return (
    <Label className={cn(INSPECTOR_ROW_GRID, "cursor-pointer py-0.5 font-normal")}>
      <span className="truncate text-muted-foreground text-xs">{label}</span>
      <span className="col-span-3 flex items-center">
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </span>
    </Label>
  );
}
