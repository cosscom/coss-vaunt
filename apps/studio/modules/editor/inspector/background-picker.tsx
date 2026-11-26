"use client";

import { Input } from "@coss/ui/components/input";
import { SegmentedRadio, SegmentedRadioGroup } from "@coss/ui/shared/segmented-radio-group";
import type { ProjectSettings } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import {
  type BackgroundFill,
  normalizeHex,
  partnerStop,
  readBackground,
  toBackground,
} from "./background-fill";
import { InspectorNumberRow } from "./inspector-number-row";
import { InspectorRow } from "./inspector-row";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.inspector;
const DEGREES: Intl.NumberFormatOptions = { style: "unit", unit: "degree", maximumFractionDigits: 0 };
type Background = ProjectSettings["background"];
type Gradient = Extract<BackgroundFill, { kind: "gradient" }>;

/** Any CSS colour as `#rrggbb` for the colour inputs, by letting the browser normalise it. */
function cssToHex(color: string): string {
  const hex = normalizeHex(color);
  if (hex) return hex;
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return "#000000";
  context.fillStyle = "#000000";
  context.fillStyle = color;
  return normalizeHex(String(context.fillStyle)) ?? "#000000";
}

/**
 * A colour as a swatch that opens the system colour picker, beside its hex code. Typing a valid hex applies it;
 * leaving the field puts back the colour in use.
 */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}): React.ReactElement {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="flex w-full min-w-0 items-center gap-1.5">
      <label
        className="relative size-7 shrink-0 cursor-pointer rounded-md shadow-xs/5 ring-1 ring-foreground/12 ring-inset focus-within:ring-2 focus-within:ring-ring"
        style={{ background: value }}>
        <input
          aria-label={copy.pickColor(label)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          onChange={(event) => onChange(event.target.value)}
          type="color"
          value={value}
        />
      </label>
      <Input
        aria-label={copy.hexColor(label)}
        className="min-w-0 flex-1 font-mono uppercase"
        maxLength={7}
        onBlur={() => setDraft(value)}
        onChange={(event) => {
          setDraft(event.target.value);
          const hex = normalizeHex(event.target.value);
          if (hex) onChange(hex);
        }}
        onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        size="sm"
        spellCheck={false}
        value={draft}
      />
    </div>
  );
}

/**
 * The composition's background: a solid colour, or a linear gradient between two colours at an angle. Switching
 * kinds starts from what was there (a gradient from the colour, the colour from the gradient's first stop) and
 * remembers the other kind's last values while the inspector stays open.
 */
export function BackgroundPicker({
  value,
  onChange,
}: {
  value: Background;
  onChange: (background: Background) => void;
}): React.ReactElement {
  const fill = readBackground(value, cssToHex);
  const lastColor = useRef<string | null>(null);
  const lastGradient = useRef<Gradient | null>(null);
  if (fill.kind === "color") lastColor.current = fill.color;
  else lastGradient.current = fill;
  const set = (next: BackgroundFill) => onChange(toBackground(next));

  return (
    <>
      <InspectorRow label={copy.fill}>
        <SegmentedRadioGroup
          aria-label={copy.fill}
          className="w-full"
          onValueChange={(kind) => {
            if (kind === fill.kind) return;
            if (kind === "color") {
              set({
                kind: "color",
                color: lastColor.current ?? (fill.kind === "gradient" ? fill.from : "#0b0b0c"),
              });
              return;
            }
            const base = fill.kind === "color" ? fill.color : "#27272a";
            set(lastGradient.current ?? { kind: "gradient", from: partnerStop(base), to: base, angle: 160 });
          }}
          size="sm"
          value={fill.kind}>
          <SegmentedRadio className="flex-1" value="color">
            {copy.solid}
          </SegmentedRadio>
          <SegmentedRadio className="flex-1" value="gradient">
            {copy.gradient}
          </SegmentedRadio>
        </SegmentedRadioGroup>
      </InspectorRow>
      {fill.kind === "color" ? (
        <InspectorRow label={copy.color}>
          <ColorField
            label={copy.color}
            onChange={(color) => set({ kind: "color", color })}
            value={fill.color}
          />
        </InspectorRow>
      ) : (
        <>
          <InspectorRow label={copy.gradientFrom}>
            <ColorField
              label={copy.gradientFrom}
              onChange={(from) => set({ ...fill, from })}
              value={fill.from}
            />
          </InspectorRow>
          <InspectorRow label={copy.gradientTo}>
            <ColorField label={copy.gradientTo} onChange={(to) => set({ ...fill, to })} value={fill.to} />
          </InspectorRow>
          <InspectorNumberRow
            format={DEGREES}
            label={copy.gradientAngle}
            max={360}
            min={0}
            onChange={(angle) => set({ ...fill, angle })}
            step={1}
            value={fill.angle}
          />
        </>
      )}
    </>
  );
}
