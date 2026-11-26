"use client";

import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@coss/ui/components/select";
import { ASPECT_RATIOS, type ProjectSettings } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type * as React from "react";
import { STUDIO_COPY } from "@/modules/studio-copy";

const items = ASPECT_RATIOS.map((ratio) => ({ value: ratio, label: ratio }));

/** The composition's aspect ratio, at the end of the stage's toolbar beside the frame it shapes. */
export function AspectRatioSelect({
  value,
  onChange,
}: {
  value: ProjectSettings["aspectRatio"];
  onChange: (aspectRatio: ProjectSettings["aspectRatio"]) => void;
}): React.ReactElement {
  return (
    <Select items={items} onValueChange={(next) => next && onChange(next)} value={value}>
      <SelectTrigger
        aria-label={STUDIO_COPY.editor.aspectRatio}
        className="w-auto min-w-0 border-transparent bg-transparent tabular-nums shadow-none hover:bg-accent">
        <SelectValue />
      </SelectTrigger>
      <SelectPopup align="end">
        {items.map((item) => (
          <SelectItem className="tabular-nums" key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
