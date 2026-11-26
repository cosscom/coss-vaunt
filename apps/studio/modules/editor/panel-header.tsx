import type * as React from "react";

export function PanelHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex h-10.5 shrink-0 items-center justify-between gap-2 border-b px-4">
      <h2 className="font-medium text-foreground text-sm">{title}</h2>
      {children}
    </div>
  );
}
