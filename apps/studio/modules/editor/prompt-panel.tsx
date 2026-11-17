"use client";

import { Button } from "@coss/ui/components/button";
import { Field, FieldLabel } from "@coss/ui/components/field";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@coss/ui/components/select";
import { Slider } from "@coss/ui/components/slider";
import { Textarea } from "@coss/ui/components/textarea";
import { SparklesIcon } from "@coss/ui/icons";
import type * as React from "react";
import { useState } from "react";
import { ComingSoonTooltip } from "./coming-soon-tooltip";
import { PanelHeader } from "./panel-header";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.prompt;
const MIN_LENGTH_SECONDS = 12;
const MAX_LENGTH_SECONDS = 60;
const routeItems = STUDIO_COPY.routes.map((route) => ({ value: route.value, label: route.label }));

export function PromptPanel(): React.ReactElement {
  const [prompt, setPrompt] = useState("");
  const [routes, setRoutes] = useState<string[]>([routeItems[0].value]);
  const [lengthSeconds, setLengthSeconds] = useState(30);

  return (
    <aside className="flex shrink-0 flex-col">
      <PanelHeader title={copy.title} />
      <div className="flex flex-col gap-5 p-4">
        <Field>
          <FieldLabel className="sr-only">{copy.promptLabel}</FieldLabel>
          <Textarea
            className="min-h-32"
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={copy.placeholder}
            value={prompt}
          />
        </Field>
        <Field>
          <FieldLabel>{copy.routes}</FieldLabel>
          <Select items={routeItems} multiple onValueChange={setRoutes} value={routes}>
            <SelectTrigger size="sm">
              <SelectValue placeholder={copy.routesPlaceholder}>
                {(value: string[]) =>
                  value
                    .map((route) => routeItems.find((item) => item.value === route)?.label ?? route)
                    .join(", ") || copy.routesPlaceholder
                }
              </SelectValue>
            </SelectTrigger>
            <SelectPopup>
              {routeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </Field>
        <Field>
          <div className="flex w-full items-center justify-between">
            <FieldLabel>{copy.length}</FieldLabel>
            <span className="text-muted-foreground text-sm tabular-nums">{lengthSeconds} s</span>
          </div>
          <Slider
            aria-label={copy.length}
            className="[&_[data-slot=slider-control]]:min-w-0"
            max={MAX_LENGTH_SECONDS}
            min={MIN_LENGTH_SECONDS}
            onValueChange={(value) => setLengthSeconds(Array.isArray(value) ? (value[0] ?? 30) : value)}
            step={1}
            value={lengthSeconds}
          />
          <div className="flex w-full justify-between text-muted-foreground text-xs tabular-nums">
            <span>{MIN_LENGTH_SECONDS} s</span>
            <span>{MAX_LENGTH_SECONDS} s</span>
          </div>
        </Field>
        <ComingSoonTooltip className="w-full">
          <Button className="w-full" disabled>
            <SparklesIcon aria-hidden="true" />
            {copy.generate}
          </Button>
        </ComingSoonTooltip>
      </div>
    </aside>
  );
}
