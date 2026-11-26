"use client";

import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@coss/ui/components/collapsible";
import { ChevronDownIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";

type InspectorSectionProps = {
  title: string;
  aside?: React.ReactNode;
  /** A control beside the title, outside the toggle so it can be a button of its own. */
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Replaces the default body padding, for lists whose rows bring their own. */
  bodyClassName?: string;
  /** Starts collapsed when false. */
  defaultOpen?: boolean;
};

export function InspectorSection({
  title,
  aside,
  action,
  children,
  bodyClassName,
  defaultOpen = true,
}: InspectorSectionProps): React.ReactElement {
  return (
    <Collapsible className="border-b" defaultOpen={defaultOpen}>
      {/* The toggle covers the whole header; the action sits on top of it, before the chevron, so the chevron stays
          at the row's end and every other pixel of the header still collapses the section. */}
      <div className="relative flex h-10 items-center gap-2 ps-4 pe-3">
        <CollapsibleTrigger
          aria-label={title}
          className="peer absolute inset-0 cursor-pointer outline-none hover:bg-accent/40 focus-visible:bg-accent/60"
        />
        <span className="pointer-events-none relative flex-1 truncate font-medium text-foreground text-sm">
          {title}
        </span>
        {aside ? (
          <span className="pointer-events-none relative text-muted-foreground text-xs tabular-nums">
            {aside}
          </span>
        ) : null}
        {action ? <span className="relative flex items-center">{action}</span> : null}
        <ChevronDownIcon
          aria-hidden="true"
          className="pointer-events-none relative size-4 shrink-0 -rotate-90 text-muted-foreground transition-transform peer-data-panel-open:rotate-0"
        />
      </div>
      <CollapsiblePanel>
        <div className={cn("flex flex-col gap-2 px-4 pt-1 pb-4", bodyClassName)}>{children}</div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
