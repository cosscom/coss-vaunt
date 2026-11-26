import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useHeaderWidth } from "./track-header-width";
import { TrackResizeHandle } from "./track-resize-handle";

/** Diagonal lines for rows that aren't tracks yet (the new-track drop rows), so they never read as real ones. */
// A 10 px tile holding one 1 px diagonal, repeated: the lines keep their spacing however wide the lane is (a
// repeating gradient across the whole lane drifted as zoom changed its width).
export const PLACEHOLDER_ROW_HATCH =
  "bg-[linear-gradient(135deg,transparent_calc(50%_-_0.5px),color-mix(in_oklab,var(--color-foreground)_5%,transparent)_calc(50%_-_0.5px)_calc(50%_+_0.5px),transparent_calc(50%_+_0.5px))] bg-size-[10px_10px]";

type TimelineRowProps = {
  height: number;
  contentWidth: number;
  header: React.ReactNode;
  /** Highlights the whole row, header included. */
  selected?: boolean;
  headerClassName?: string;
  /** Makes the row's bottom edge a handle that changes its height. */
  resize?: { label: string; onResize: (height: number) => void; onReset: () => void };
} & React.ComponentProps<"div">;

/** A sticky header cell beside a lane of the timeline's width. */
export function TimelineRow({
  height,
  contentWidth,
  header,
  children,
  className,
  selected = false,
  headerClassName,
  resize,
  ...contentProps
}: TimelineRowProps): React.ReactElement {
  const headerWidth = useHeaderWidth();
  return (
    // Each cell draws its own bottom border rather than the row: the playhead runs under the sticky header, and a
    // row border would leave a pixel outside the header for it to show through as you scroll.
    <div className="relative flex" style={{ height }}>
      <div
        className={cn(
          "sticky left-0 z-20 flex shrink-0 items-center gap-2 border-e border-b bg-background ps-2 pe-1.5",
          selected && "bg-accent",
          headerClassName
        )}
        style={{ width: headerWidth }}>
        {header}
      </div>
      <div
        className={cn("relative border-b", selected && "bg-accent/48", className)}
        style={{ width: contentWidth }}
        {...contentProps}>
        {children}
      </div>
      {resize ? (
        <TrackResizeHandle
          value={height}
          label={resize.label}
          onReset={resize.onReset}
          onResize={resize.onResize}
        />
      ) : null}
    </div>
  );
}
