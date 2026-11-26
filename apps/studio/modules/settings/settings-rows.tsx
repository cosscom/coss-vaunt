"use client";

import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";

/** A titled group of rows on one card, like T3 Code's settings. */
export function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-1 px-1">
        <h2 className="font-semibold text-base">{title}</h2>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </header>
      <div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">{children}</div>
    </section>
  );
}

/**
 * One setting: its title and description on the left, the control on the right. `children` go under both, for a
 * row that opens up (a key being typed, a test's result).
 */
export function SettingsRow({
  title,
  description,
  control,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  control?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div className={cn("flex flex-col gap-3 px-4 py-3.5", className)}>
      <div className="flex min-h-8 items-center gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2 font-medium text-sm">{title}</div>
          {description ? <div className="text-muted-foreground text-sm">{description}</div> : null}
        </div>
        {control ? <div className="flex shrink-0 items-center gap-1.5">{control}</div> : null}
      </div>
      {children}
    </div>
  );
}
