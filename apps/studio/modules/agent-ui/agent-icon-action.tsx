"use client";

import { Button } from "@coss/ui/components/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import type { ReactNode } from "react";

export function AgentIconAction({
  children,
  href,
  label,
  onClick,
}: {
  children: ReactNode;
  href?: string;
  label: string;
  onClick?: () => void;
}): React.ReactElement {
  const className = "text-muted-foreground hover:text-foreground";
  let trigger: React.ReactElement = (
    <Button
      aria-label={label}
      aria-disabled={onClick == null}
      className={className}
      onClick={onClick}
      size="icon-xs"
      type="button"
      variant="ghost"
    />
  );
  if (href != null) {
    trigger = (
      <Button
        aria-label={label}
        className={className}
        render={<a href={href} />}
        size="icon-xs"
        variant="ghost"
      />
    );
  }

  return (
    <Tooltip disableHoverablePopup>
      <TooltipTrigger render={trigger}>{children}</TooltipTrigger>
      <TooltipPopup side="bottom">{label}</TooltipPopup>
    </Tooltip>
  );
}
