"use client";

import {
  getTextEffect,
  listTextEffects,
} from "@calcom/product-video/catalogues/text-effects/text-effect-catalogue";
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@coss/ui/components/select";
import * as React from "react";
import { InspectorRow } from "../inspector/inspector-row";
import { groupTextEffects } from "./text-effect-groups";
import { TextEffectPreview } from "./text-effect-preview";
import { STUDIO_COPY } from "@/modules/studio-copy";

export type TextEffectPickerProps = {
  label: string;
  /** Catalogue id, or undefined for no effect. */
  value: string | undefined;
  onChange: (effectId: string | undefined) => void;
  /** The clip's own words, for live previews. */
  previewText: string;
};

const NONE = "none";
const copy = STUDIO_COPY.textEffects;

/** Picks an enter or exit effect from the catalogue; the option under the pointer or focus plays on the clip's words. */
export function TextEffectPicker({
  label,
  value,
  onChange,
  previewText,
}: TextEffectPickerProps): React.ReactElement {
  const effects = listTextEffects();
  const groups = React.useMemo(() => groupTextEffects(effects), [effects]);
  const items = React.useMemo(
    () => [
      { value: NONE, label: copy.none },
      ...effects.map((effect) => ({ value: effect.id, label: effect.displayName })),
    ],
    [effects]
  );
  const [highlighted, setHighlighted] = React.useState<string | undefined>(undefined);
  const previewId = highlighted ?? value ?? NONE;
  const highlight = (id: string) => ({
    onFocus: () => setHighlighted(id),
    onPointerEnter: () => setHighlighted(id),
  });

  return (
    <InspectorRow label={label}>
      <Select
        items={items}
        onOpenChange={(open) => {
          if (!open) setHighlighted(undefined);
        }}
        onValueChange={(next) => onChange(next === null || next === NONE ? undefined : next)}
        value={value ?? NONE}>
        <SelectTrigger aria-label={label} size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup alignItemWithTrigger={false} className="w-72">
          <div aria-hidden className="sticky top-0 z-10 -mx-1 -mt-1 mb-1 border-b bg-popover px-2">
            <TextEffectPreview
              effect={previewId === NONE ? undefined : getTextEffect(previewId)}
              text={previewText}
            />
          </div>
          <SelectItem value={NONE} {...highlight(NONE)}>
            {copy.none}
          </SelectItem>
          {groups.map((group) => (
            <SelectGroup key={group.target}>
              <SelectGroupLabel>{copy.groups[group.target]}</SelectGroupLabel>
              {group.effects.map((effect) => (
                <SelectItem key={effect.id} value={effect.id} {...highlight(effect.id)}>
                  <span className="flex min-w-0 flex-col">
                    <span>{effect.displayName}</span>
                    <span className="truncate text-muted-foreground text-xs">{effect.description}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectPopup>
      </Select>
    </InspectorRow>
  );
}
