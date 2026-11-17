import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { TRACK_HEADER_WIDTH_PX } from "./timeline-metrics";

type TimelineRowProps = {
  height: number;
  contentWidth: number;
  header: React.ReactNode;
  /** Highlights the whole row, header included. */
  selected?: boolean;
} & React.ComponentProps<"div">;

/** A sticky header cell beside a lane of the timeline's width. */
export function TimelineRow({
  height,
  contentWidth,
  header,
  children,
  className,
  selected = false,
  ...contentProps
}: TimelineRowProps): React.ReactElement {
  return (
    <div className="flex border-b" style={{ height }}>
      <div
        className={cn(
          "sticky left-0 z-20 flex shrink-0 items-center gap-2 border-e bg-background ps-3 pe-1.5",
          selected && "bg-accent"
        )}
        style={{ width: TRACK_HEADER_WIDTH_PX }}>
        {header}
      </div>
      <div
        className={cn("relative", selected && "bg-accent/48", className)}
        style={{ width: contentWidth }}
        {...contentProps}>
        {children}
      </div>
    </div>
  );
}
