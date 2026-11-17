"use client";

import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@coss/ui/components/collapsible";
import { ChevronDownIcon } from "@coss/ui/icons";
import type * as React from "react";

type InspectorSectionProps = {
  title: string;
  aside?: React.ReactNode;
  /** A control beside the title, outside the toggle so it can be a button of its own. */
  action?: React.ReactNode;
  children: React.ReactNode;
};

export function InspectorSection({
  title,
  aside,
  action,
  children,
}: InspectorSectionProps): React.ReactElement {
  return (
    <Collapsible className="border-b" defaultOpen>
      <div className="flex items-center">
        <CollapsibleTrigger className="group flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 px-4 text-start outline-none hover:bg-accent/40 focus-visible:bg-accent/60">
          <span className="flex-1 font-medium text-foreground text-sm">{title}</span>
          {aside ? <span className="text-muted-foreground text-xs tabular-nums">{aside}</span> : null}
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 -rotate-90 text-muted-foreground transition-transform group-data-panel-open:rotate-0"
          />
        </CollapsibleTrigger>
        {action ? <span className="flex h-10 items-center pe-2">{action}</span> : null}
      </div>
      <CollapsiblePanel>
        <div className="flex flex-col gap-2 px-4 pt-1 pb-4">{children}</div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
