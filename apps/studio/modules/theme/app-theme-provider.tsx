"use client";

import { AnchoredToastProvider, ToastProvider } from "@coss/ui/components/toast";
import { TooltipProvider } from "@coss/ui/components/tooltip";
import { ThemeProvider } from "next-themes";
import type * as React from "react";
import { SettingsProvider } from "@/modules/settings/settings-provider";

/** The app-wide providers: theme, tooltips, toasts and Settings. */
export function AppThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableColorScheme
      enableSystem
      // The theme script only needs to run from the server's HTML, before first paint. Rendered again on the client,
      // React 19 warns about a <script> in a component; a non-JS type there keeps it inert and quiet (next-themes
      // suppresses the hydration mismatch on its script).
      scriptProps={{ type: typeof window === "undefined" ? "text/javascript" : "text/plain" }}>
      <TooltipProvider delay={300}>
        <ToastProvider position="bottom-right">
          <AnchoredToastProvider>
            <SettingsProvider>{children}</SettingsProvider>
          </AnchoredToastProvider>
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
