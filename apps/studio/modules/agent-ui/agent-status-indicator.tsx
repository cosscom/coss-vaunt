import {
  ChevronRightIcon,
  CircleCheckIcon,
  CircleIcon,
  CircleXIcon,
  type IconComponent,
  InfoIcon,
} from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import type { ComponentProps, ReactElement } from "react";
import { AgentMorphLoader } from "./agent-morph-loader";

type AgentStatus = "idle" | "thinking" | "working" | "needs-input" | "complete" | "error";

type AgentStatusIndicatorProps = Omit<
  ComponentProps<"span">,
  "aria-busy" | "aria-label" | "aria-live" | "children" | "role"
> & {
  announce?: boolean;
  disclosure?: boolean;
  muted?: boolean;
  label: string;
  status: AgentStatus;
  wrap?: boolean;
};

const statusClassNames: Record<AgentStatus, string> = {
  idle: "text-muted-foreground",
  thinking: "text-muted-foreground",
  working: "text-muted-foreground",
  "needs-input": "text-warning-foreground",
  complete: "text-success-foreground",
  error: "text-destructive-foreground",
};

const statusIcons: Record<Exclude<AgentStatus, "thinking" | "working">, IconComponent> = {
  idle: CircleIcon,
  "needs-input": InfoIcon,
  complete: CircleCheckIcon,
  error: CircleXIcon,
};

/** A presentation-only status treatment for AI agent surfaces. */
export function AgentStatusIndicator({
  announce = true,
  className,
  disclosure = false,
  label,
  muted = false,
  status,
  wrap = false,
  ...props
}: AgentStatusIndicatorProps): ReactElement {
  let colorClassName = statusClassNames[status];
  if (muted) colorClassName = "text-muted-foreground";

  const isActive = status === "thinking" || status === "working";
  let statusIcon = <AgentMorphLoader />;
  if (status !== "thinking" && status !== "working") {
    const Icon = statusIcons[status];
    statusIcon = <Icon aria-hidden="true" className="size-3.5 shrink-0" />;
  }

  let accessibilityProps: Pick<
    ComponentProps<"span">,
    "aria-busy" | "aria-label" | "aria-live" | "role"
  > = {};
  if (announce) {
    accessibilityProps = {
      "aria-label": label,
      "aria-live": "polite",
      role: "status",
    };
  }

  let trailing: ReactElement | undefined;
  if (disclosure) {
    trailing = (
      <ChevronRightIcon
        aria-hidden="true"
        className="h-lh w-3.5 shrink-0 in-data-panel-open:rotate-90 text-muted-foreground transition-transform motion-reduce:transition-none"
      />
    );
  }

  return (
    <span
      {...props}
      {...accessibilityProps}
      className={cn("inline-flex min-w-0 max-w-full items-start gap-1.5 text-xs", colorClassName, className)}
      data-slot="agent-status-indicator"
      data-status={status}>
      <span className="flex h-lh w-3.5 shrink-0 items-center justify-center">{statusIcon}</span>
      <span
        className={cn(
          "min-w-0 whitespace-normal font-normal [overflow-wrap:anywhere]",
          wrap && "break-words",
          colorClassName,
          status === "error" && "font-medium",
          isActive &&
            "animate-[skeleton_1.8s_infinite_linear] bg-clip-text bg-no-repeat text-transparent [background-image:linear-gradient(105deg,transparent_10%,--alpha(var(--color-info-foreground)/28%)_16%,--alpha(var(--color-white)/48%)_28%,--alpha(var(--color-white)/48%)_44%,transparent_50%),linear-gradient(var(--color-muted-foreground),var(--color-muted-foreground))] [background-position:100%_0,0_0] [background-size:200%_100%,100%_100%] motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-muted-foreground"
        )}
        data-slot="agent-status-indicator-label">
        {label}
      </span>
      {trailing}
    </span>
  );
}

export type { AgentStatus, AgentStatusIndicatorProps };
