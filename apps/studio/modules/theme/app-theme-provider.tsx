"use client";

import { AnchoredToastProvider, ToastProvider } from "@coss/ui/components/toast";
import { TooltipProvider } from "@coss/ui/components/tooltip";
import { ThemeProvider } from "next-themes";
import type * as React from "react";

export function AppThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableColorScheme
      enableSystem>
      <TooltipProvider delay={300}>
        <ToastProvider position="bottom-right">
          <AnchoredToastProvider>{children}</AnchoredToastProvider>
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
