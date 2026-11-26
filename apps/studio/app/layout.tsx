import type { Metadata } from "next";
import localFont from "next/font/local";
import { STUDIO_COPY } from "@/modules/studio-copy";
import { AppThemeProvider } from "@/modules/theme/app-theme-provider";
import "./globals.css";

const fontSans = localFont({
  src: [{ path: "../fonts/CalSansVF.woff2", style: "normal" }],
  variable: "--font-sans",
  weight: "400 700",
  display: "swap",
});

const fontHeading = localFont({
  src: [{ path: "../fonts/CalSansVF.woff2", style: "normal" }],
  variable: "--font-heading",
  weight: "400 700",
  display: "block",
});

export const metadata: Metadata = {
  title: { default: STUDIO_COPY.appName, template: `%s · ${STUDIO_COPY.appName}` },
  description: STUDIO_COPY.appDescription,
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontHeading.variable} bg-background pt-(--titlebar-inset) font-sans text-foreground antialiased`}>
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  );
}
