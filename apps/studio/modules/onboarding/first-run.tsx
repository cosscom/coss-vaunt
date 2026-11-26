"use client";

import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useEffect, useState } from "react";
import { Onboarding } from "./onboarding";
import { growWindowTo } from "@/modules/desktop/desktop-window";
import { markIntroSeen } from "@/modules/intro/intro-gate";

/** The studio window's size once onboarding hands over, when the screen has room for it. */
const STUDIO_WINDOW = { width: 1920, height: 1080 };
/** The onboarding fades out (an exit, so quicker), the window grows, then the studio fades in. */
const FADE_OUT_MS = 280;

type Phase = "onboarding" | "leaving" | "studio";

/**
 * First run: the onboarding over the projects page, which waits underneath, hidden and inert. Finishing records
 * it, fades the onboarding out, grows the desktop window to 1920 × 1080 (if the screen has room), then fades the
 * studio in. The onboarding stands in for the startup intro on this visit, since its first slide is the intro.
 */
export function FirstRun({ children }: { children: React.ReactNode }): React.ReactElement {
  const [phase, setPhase] = useState<Phase>("onboarding");

  useEffect(() => {
    markIntroSeen();
  }, []);

  useEffect(() => {
    if (phase === "studio") return;
    // The page underneath must not scroll behind the onboarding.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [phase]);

  const finish = async () => {
    if (phase !== "onboarding") return;
    void fetch("/api/onboarding", { method: "PUT" }).catch(() => undefined);
    setPhase("leaving");
    await new Promise((resolve) => setTimeout(resolve, FADE_OUT_MS));
    await growWindowTo(STUDIO_WINDOW.width, STUDIO_WINDOW.height);
    setPhase("studio");
  };

  return (
    <>
      <div
        aria-hidden={phase !== "studio" || undefined}
        className={cn(
          "transition-[opacity,translate,filter] duration-[560ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
          phase === "studio" ? "translate-y-0 opacity-100 blur-0" : "translate-y-2 opacity-0 blur-[2px]"
        )}
        inert={phase !== "studio"}>
        {children}
      </div>
      {phase !== "studio" && (
        <div
          className={cn(
            "transition-opacity ease-in motion-reduce:transition-none",
            phase === "leaving" && "opacity-0"
          )}
          style={{ transitionDuration: `${FADE_OUT_MS}ms` }}>
          <Onboarding onFinish={() => void finish()} />
        </div>
      )}
    </>
  );
}
