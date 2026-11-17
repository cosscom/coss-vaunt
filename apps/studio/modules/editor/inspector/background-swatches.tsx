"use client";

import type { ProjectSettings } from "@calcom/product-video/storyboard/storyboard-schema";
import { RadioGroupPrimitive, RadioPrimitive } from "@coss/ui/components/radio-group";
import { CheckIcon } from "@coss/ui/icons";
import type * as React from "react";
import { InspectorRow } from "./inspector-row";
import { STUDIO_COPY } from "@/modules/studio-copy";

type Background = ProjectSettings["background"];

const SWATCHES: { label: string; background: Background }[][] = [
  [
    { label: "Ink", background: { kind: "color", value: "#0b0b0c" } },
    { label: "Graphite", background: { kind: "color", value: "#27272a" } },
    { label: "Mist", background: { kind: "color", value: "#e4e4e7" } },
    { label: "Paper", background: { kind: "color", value: "#fafafa" } },
  ],
  [
    {
      label: "Night",
      background: { kind: "gradient", value: "linear-gradient(160deg, #27272a 0%, #050506 100%)" },
    },
    {
      label: "Spotlight",
      background: { kind: "gradient", value: "radial-gradient(120% 90% at 50% 0%, #52525b 0%, #09090b 70%)" },
    },
    {
      label: "Haze",
      background: { kind: "gradient", value: "linear-gradient(160deg, #ffffff 0%, #d4d4d8 100%)" },
    },
    {
      label: "Dawn",
      background: { kind: "gradient", value: "linear-gradient(160deg, #e0e7ff 0%, #f4f4f5 60%)" },
    },
  ],
];

type BackgroundSwatchesProps = { value: Background; onChange: (background: Background) => void };

const ALL_SWATCHES = SWATCHES.flat();

/** One radio group across both rows, so exactly one background reads as selected. */
export function BackgroundSwatches({ value, onChange }: BackgroundSwatchesProps): React.ReactElement {
  return (
    <RadioGroupPrimitive
      aria-label={STUDIO_COPY.inspector.background}
      className="flex flex-col gap-2"
      onValueChange={(label) => {
        const swatch = ALL_SWATCHES.find((candidate) => candidate.label === label);
        if (swatch) onChange(swatch.background);
      }}
      value={ALL_SWATCHES.find((swatch) => swatch.background.value === value.value)?.label ?? ""}>
      {SWATCHES.map((row, rowIndex) => (
        <InspectorRow
          key={row[0]?.background.kind}
          label={rowIndex === 0 ? STUDIO_COPY.inspector.color : STUDIO_COPY.inspector.gradient}>
          <div className="grid w-full grid-cols-4 gap-1.5">
            {row.map((swatch) => (
              <RadioPrimitive.Root
                aria-label={swatch.label}
                className="group/swatch relative flex h-7 cursor-pointer items-center justify-center rounded-md shadow-xs/5 outline-none ring-1 ring-foreground/12 ring-inset focus-visible:ring-2 focus-visible:ring-ring data-checked:ring-2 data-checked:ring-foreground data-checked:ring-offset-2 data-checked:ring-offset-background"
                data-testid="background-swatch"
                key={swatch.label}
                style={{ background: swatch.background.value }}
                value={swatch.label}>
                <RadioPrimitive.Indicator className="flex size-4 items-center justify-center rounded-full bg-background text-foreground shadow-sm/10 data-unchecked:hidden">
                  <CheckIcon aria-hidden="true" className="size-3" />
                </RadioPrimitive.Indicator>
              </RadioPrimitive.Root>
            ))}
          </div>
        </InspectorRow>
      ))}
    </RadioGroupPrimitive>
  );
}
