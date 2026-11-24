"use client";

import type * as React from "react";
import { useEffect, useRef } from "react";
import { centredRect, flightTransform, type ScreenRect, withAspect } from "./intro-flight";
import { markIntroSeen, markIntroStarted } from "./intro-gate";
import { createParticleReveal, REVEAL_SETTLED_SECONDS } from "./particle-reveal";
import { Wordmark } from "@/modules/brand/wordmark";
import {
  WORDMARK_COSS_PATH,
  WORDMARK_VAUNT_PATH,
  WORDMARK_VAUNT_TONE,
  WORDMARK_VIEWBOX,
} from "@/modules/brand/wordmark-outline";
import { STUDIO_COPY } from "@/modules/studio-copy";

/** The logo's trip into the header; it moves on screen, so it eases both ways. */
const FLIGHT_MS = 760;
const FLIGHT_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
const SKIP_FADE_MS = 240;
const TARGET = "[data-studio-wordmark]";
/** However the reveal runs (a slow GPU, a throttled tab), the page is uncovered after this long. */
const HARD_LIMIT_MS = 14000;

/**
 * The startup intro over the projects page: the particle reveal forms the logo, which then flies into the
 * header's while the black lifts. Shown only when the gate script marked `<html data-intro="play">`; a click or
 * key skips it.
 */
export function StudioIntro(): React.ReactElement {
  const overlay = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const flyer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (document.documentElement.dataset.intro !== "play") {
      if (overlay.current) overlay.current.style.display = "none";
      return;
    }
    markIntroStarted();
    const root = overlay.current;
    const cover = backdrop.current;
    const surface = canvas.current;
    const logo = flyer.current;
    if (!root || !cover || !surface || !logo) return;

    const { width, height } = WORDMARK_VIEWBOX;
    const reveal = createParticleReveal(
      surface,
      [
        { d: WORDMARK_COSS_PATH, tone: 1 },
        { d: WORDMARK_VAUNT_PATH, tone: WORDMARK_VAUNT_TONE },
      ],
      WORDMARK_VIEWBOX
    );
    let frame = 0;
    let finished = false;
    const timers: number[] = [];

    const stop = () => {
      cancelAnimationFrame(frame);
      for (const timer of timers) clearTimeout(timer);
      reveal?.destroy();
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      stop();
      markIntroSeen();
      root.style.display = "none";
    };

    const handOff = (drawn: ScreenRect) => {
      cancelAnimationFrame(frame);
      // The sampled ink is a pixel or two off the outline's proportions; match the outline so it lands exactly.
      const from = withAspect(drawn, width / height);
      const target = document.querySelector(TARGET)?.getBoundingClientRect();
      Object.assign(logo.style, {
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        opacity: "1",
      });
      surface.style.opacity = "0";
      root.dataset.leaving = "";
      if (!target) {
        timers.push(window.setTimeout(finish, SKIP_FADE_MS));
        return;
      }
      // Next frame, so the start position is painted before the flight begins.
      frame = requestAnimationFrame(() => {
        logo.style.transition = `transform ${FLIGHT_MS}ms ${FLIGHT_EASE}`;
        logo.style.transform = flightTransform(from, target);
        logo.dataset.landed = "";
        cover.style.transition = `opacity ${FLIGHT_MS * 0.7}ms ease-out ${FLIGHT_MS * 0.15}ms`;
        cover.style.opacity = "0";
        logo.addEventListener("transitionend", (event) => {
          if (event.target === logo && event.propertyName === "transform") finish();
        });
        timers.push(window.setTimeout(finish, FLIGHT_MS + 250));
      });
    };

    const skip = () => {
      if (finished) return;
      cancelAnimationFrame(frame);
      root.style.transition = `opacity ${SKIP_FADE_MS}ms ease-out`;
      root.style.opacity = "0";
      timers.push(window.setTimeout(finish, SKIP_FADE_MS));
    };

    if (!reveal) {
      handOff(centredRect(width / height, { width: innerWidth, height: innerHeight }));
    } else {
      let t = 0;
      let clock = 0;
      let last = 0;
      const tick = (now: number) => {
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
        last = now;
        t += dt;
        clock += dt;
        reveal.render(t, clock);
        if (t >= REVEAL_SETTLED_SECONDS) handOff(reveal.logoRect());
        else frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      surface.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        skip();
      });
    }

    timers.push(window.setTimeout(skip, HARD_LIMIT_MS));

    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      skip();
    };
    root.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", onKey);
      // Unmounting isn't finishing: React's development remount runs the intro again from the start.
      stop();
    };
  }, []);

  return (
    <div
      aria-label={STUDIO_COPY.intro.label}
      className="studio-intro group/intro fixed inset-0 z-[100] cursor-pointer select-none"
      ref={overlay}
      role="img">
      <div className="absolute inset-0 bg-black" ref={backdrop} />
      <canvas
        aria-hidden="true"
        className="absolute inset-0 size-full transition-opacity duration-150 ease-out"
        ref={canvas}
      />
      <div aria-hidden="true" className="group fixed origin-top-left opacity-0" ref={flyer}>
        <Wordmark
          className="size-full"
          cossClassName="text-[#f2f4f7] transition-colors duration-700 group-data-landed:text-foreground"
          vauntClassName="text-[#f2f4f7]/42 transition-colors duration-700 group-data-landed:text-muted-foreground/64"
        />
      </div>
      <p className="absolute inset-x-0 bottom-8 animate-[studio-intro-hint_400ms_ease-out_1.6s_both] text-center text-white/40 text-xs transition-opacity duration-200 group-data-leaving/intro:opacity-0">
        {STUDIO_COPY.intro.skip}
      </p>
    </div>
  );
}
