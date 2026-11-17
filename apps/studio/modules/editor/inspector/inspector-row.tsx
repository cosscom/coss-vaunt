import type * as React from "react";

export const INSPECTOR_ROW_GRID = "grid grid-cols-[6rem_minmax(0,1fr)_4.5rem_1.75rem] items-center gap-x-2";

/** A label and a control spanning the row, aligned with the number rows' columns. */
export function InspectorRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className={INSPECTOR_ROW_GRID}>
      <label className="truncate text-muted-foreground text-xs" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="col-span-3 flex min-w-0 items-center">{children}</div>
    </div>
  );
}
