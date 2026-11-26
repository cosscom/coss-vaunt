"use client";

// The first-run onboarding: welcome, the studio, your media, then setting up Chromium and ffmpeg.
import { Button } from "@coss/ui/components/button";
import { Kbd } from "@coss/ui/components/kbd";
import {
  ArrowLeftIcon,
  CheckIcon,
  CircleAlertIcon,
  CopyIcon,
  CornerDownLeftIcon,
  GithubIcon,
  LoaderIcon,
} from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BorderBeam } from "@/modules/border-beam/border-beam";
import { type BeamState, CARD_BEAM } from "@/modules/border-beam/border-beam-engine";
import {
  WORDMARK_COSS_PATH,
  WORDMARK_VAUNT_PATH,
  WORDMARK_VAUNT_TONE,
  WORDMARK_VIEWBOX,
} from "@/modules/brand/wordmark-outline";
import { createParticleReveal, REVEAL_SECONDS } from "@/modules/intro/particle-reveal";
import "./onboarding.css";
import { AppIcon, ChromiumLogo, FfmpegLogo, XMark } from "./brand-marks";
import { EffectText, motion, TEXT_EFFECTS, useReducedMotion } from "./feature-cards";
import { Bento, TileWalk } from "./studio-slides";
import { type ToolsStatus, useSetupTools } from "./use-setup-tools";

/* --------------------------------------------------------------- layout --------------------------------------------------------------- */

/** One slide: copy bottom-left, the visual filling the right. The copy staggers in 50ms apart. */
export function Slide({
  tag,
  title,
  body,
  visual,
  aside,
  visualClassName,
}: {
  tag: string;
  title: React.ReactNode;
  body: React.ReactNode;
  visual: React.ReactNode;
  aside?: React.ReactNode;
  visualClassName?: string;
}): React.ReactElement {
  return (
    <div className="grid size-full grid-cols-[minmax(340px,5fr)_7fr] gap-6">
      {/* Anchored from the top, not the bottom: the badge and the title's first line sit at the same height on every
          slide, however long the copy under them runs. */}
      <div className="flex flex-col justify-start gap-4 pt-[34vh] pl-12">
        <span className="onb-in w-fit rounded-md bg-info/14 px-2 py-0.5 font-medium text-info-foreground text-sm [--d:0ms]">
          {tag}
        </span>
        <h1 className="onb-in max-w-[13ch] text-balance font-heading text-[44px] text-foreground leading-[1.05] tracking-[-0.02em] [--d:50ms]">
          {title}
        </h1>
        <p className="onb-in max-w-[40ch] text-pretty text-[17px] text-muted-foreground leading-[1.45] [--d:100ms]">
          {body}
        </p>
        {aside && <div className="onb-in pt-2 [--d:150ms]">{aside}</div>}
      </div>
      <div className={cn("onb-in onb-visual relative min-h-0 min-w-0 [--d:80ms]", visualClassName)}>
        {visual}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- slides --------------------------------------------------------------- */

/** The reveal skips its dark lead-in: below this the sweep hasn't reached the logo and the canvas is near black. */
const REVEAL_START = 2.2;
/** And plays a touch faster than the startup intro, since it shares the slide with copy to read. */
const REVEAL_RATE = 1.2;

/**
 * The startup intro on the first slide: the same particle reveal forming the wordmark, full width with the edges
 * fading into the window, instead of a panel or an overlay.
 */
function IntroReveal(): React.ReactElement {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    const reveal = createParticleReveal(
      surface,
      [
        { d: WORDMARK_COSS_PATH, tone: 1 },
        { d: WORDMARK_VAUNT_PATH, tone: WORDMARK_VAUNT_TONE },
      ],
      WORDMARK_VIEWBOX
    );
    if (!reveal) {
      setFallback(true);
      return;
    }
    let raf = 0;
    let last = 0;
    // Reduced motion lands on the formed logo, still.
    let t = reduced ? REVEAL_SECONDS : REVEAL_START;
    let clock = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) * motion.speed : 0;
      last = now;
      if (!reduced) {
        t = Math.min(REVEAL_SECONDS, t + dt * REVEAL_RATE);
        clock += dt;
      }
      reveal.render(t, clock);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      reveal.destroy();
    };
  }, [reduced]);
  return (
    // The canvas is opaque black; screening the masked layer keeps only the particles' light, so the slide's
    // gradient and grain show through. (On the canvas itself the mask's group would screen against nothing.)
    <div
      className="absolute inset-0 mix-blend-screen"
      style={{ maskImage: "radial-gradient(ellipse 60% 62% at 50% 50%, black 40%, transparent 100%)" }}>
      <canvas
        aria-label="The coss vaunt logo forming from particles"
        className="size-full"
        ref={canvas}
        role="img"
      />
      {fallback && (
        <div className="absolute inset-0 flex items-center justify-center font-heading text-6xl text-white">
          coss vaunt
        </div>
      )}
    </div>
  );
}

/** Space between the formed logo and the title. */
const LOGO_GAP = 44;
/** Lift the logo-and-copy group a little above true centre: a group at the exact middle reads as sitting low. */
const OPTICAL_LIFT = 0.025;
/** The copy waits for the logo: the title starts as the wordmark becomes legible, the line after it. */
const TITLE_DELAY_MS = 2800;
const BODY_DELAY_MS = 3400;

/**
 * Where the reveal's logo ends up, as a fraction of the canvas width: the reveal fits the wordmark to this share
 * of the width (narrow canvases get more), centred. Mirrors `fitW` in particle-reveal.ts.
 */
function logoWidthShare(aspect: number): number {
  const t = Math.min(1, Math.max(0, (aspect - 0.7) / 0.9));
  return 0.7 + (0.46 - 0.7) * t;
}

/**
 * The logo and the copy as one centred group: the canvas is shifted so the formed wordmark sits at the top of the
 * group, and the copy hangs a fixed gap below it.
 */
function WelcomeSlide(): React.ReactElement {
  const box = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  // The canvas keeps covering the whole slide: it grows upward by twice the shift (or downward), so its centre,
  // where the logo forms, moves by `shift` without leaving an uncovered strip.
  const [layout, setLayout] = useState({ shift: 0, top: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      if (!box.current || !copy.current) return;
      const width = box.current.clientWidth;
      const height = box.current.clientHeight;
      const copyHeight = copy.current.offsetHeight;
      // The logo's size depends on the canvas's aspect, which depends on the shift; a few passes settle it.
      let shift = 0;
      let top = 0;
      let logoHeight = 0;
      for (let pass = 0; pass < 4; pass++) {
        const canvasHeight = height + 2 * Math.abs(shift);
        logoHeight =
          (logoWidthShare(width / canvasHeight) * width * WORDMARK_VIEWBOX.height) / WORDMARK_VIEWBOX.width;
        top = (height - (logoHeight + LOGO_GAP + copyHeight)) / 2 - height * OPTICAL_LIFT;
        shift = top + logoHeight / 2 - height / 2;
      }
      setLayout({ shift, top: top + logoHeight + LOGO_GAP });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (box.current) observer.observe(box.current);
    if (copy.current) observer.observe(copy.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="onb-leave relative size-full" ref={box}>
      <div
        className="absolute inset-x-0"
        style={{
          top: Math.min(0, 2 * layout.shift),
          bottom: Math.min(0, -2 * layout.shift),
        }}>
        <IntroReveal />
      </div>
      <div
        className="absolute inset-x-0 flex flex-col items-center gap-3 px-8 text-center"
        ref={copy}
        style={{ top: layout.top }}>
        {/* The studio's own text effects: Soft Blur letter by letter on the title, then the line resolving into focus. */}
        <EffectText
          as="h1"
          className="text-balance font-heading text-[44px] text-foreground leading-[1.05] tracking-[-0.02em]"
          delayMs={TITLE_DELAY_MS}
          spec={TEXT_EFFECTS.softBlurIn}
          text="Product videos, made from your app"
        />
        <EffectText
          className="max-w-[46ch] text-pretty text-[17px] text-muted-foreground leading-[1.45]"
          delayMs={BODY_DELAY_MS}
          spec={TEXT_EFFECTS.focusBlurResolve}
          text="Record your app, direct it on a 3D stage and export a launch video, all on this machine."
        />
      </div>
    </div>
  );
}

function useCopied(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return [copied, copy];
}

/** A tool's card, lit like a storyboard scene card: a beam while it works, a green ring once it's ready. */
function ToolRow({
  beam,
  icon,
  name,
  detail,
  status,
  action,
  children,
}: {
  beam: BeamState;
  icon: React.ReactNode;
  name: string;
  detail: React.ReactNode;
  status: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <BorderBeam options={CARD_BEAM} state={beam}>
      <section className="flex flex-col gap-4 rounded-2xl bg-white/[0.035] p-5 shadow-[0_0_0_1px_rgb(255_255_255/0.07)] backdrop-blur-sm">
        <div className="flex items-start gap-3.5">
          {icon}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-base text-foreground">{name}</h3>
              {status}
            </div>
            <p className="text-pretty text-muted-foreground text-sm leading-5">{detail}</p>
          </div>
          {action}
        </div>
        {children}
      </section>
    </BorderBeam>
  );
}

const UNLOCKS = ["Smooth playback", "MP4 and ProRes export", "Video and audio imports"];

const MB = 1024 * 1024;
const megabytes = (bytes: number) => (bytes / MB).toFixed(1);

function ReadyLabel(): React.ReactElement {
  return (
    <span className="flex items-center gap-1 text-sm text-success-foreground">
      <CheckIcon className="size-3.5" /> Ready
    </span>
  );
}

/** Where a ready ffmpeg came from, in a line: vaunt's own copy, or the one already on this machine. */
function ffmpegReadyDetail(ffmpeg: ToolsStatus["ffmpeg"]): string {
  const version = ffmpeg.version ? `ffmpeg ${ffmpeg.version}` : "ffmpeg";
  return ffmpeg.source === "vaunt"
    ? `${version} with libx264 and libwebp, in ~/.vaunt/bin.`
    : `Using ${version} already on this computer${ffmpeg.path ? ` (${ffmpeg.path})` : ""}.`;
}

/**
 * Setup: Chromium (the launcher downloads it before the studio starts, so it's normally ready) and ffmpeg, which
 * the user installs here with one click, into ~/.vaunt/bin, or with Homebrew.
 */
function SetupSlide({ tools }: { tools: ReturnType<typeof useSetupTools> }): React.ReactElement {
  const [copied, copy] = useCopied();
  const { status, install, startInstall } = tools;
  const ffmpeg = status?.ffmpeg;
  const ready = Boolean(ffmpeg?.ready);
  const busy = install.phase === "downloading" || install.phase === "verifying";
  const size = ffmpeg?.downloadBytes ? `About ${Math.round(ffmpeg.downloadBytes / MB)} MB.` : "";
  // An ffmpeg exists but lacks an encoder vaunt needs (no ffmpeg at all also lists every encoder as missing).
  const partial = ffmpeg && !ffmpeg.ready && ffmpeg.path !== null && ffmpeg.missingEncoders.length > 0;
  const total = install.phase === "downloading" ? install.total : null;

  return (
    <Slide
      body={
        <>
          vaunt records your app with Chromium and builds previews and exports with ffmpeg. Both live in{" "}
          <code className="rounded bg-white/6 px-1 py-0.5 font-mono text-[15px] text-foreground/80">
            ~/.vaunt
          </code>
          , outside your system.
        </>
      }
      tag="Setup"
      title="Two tools to record and export"
      visual={
        <div className="flex h-full flex-col justify-center gap-3 pr-12">
          <ToolRow
            beam={status?.chromium.ready ? "success" : "idle"}
            detail={
              status && !status.chromium.ready
                ? "Not downloaded yet. vaunt fetches it the next time it starts."
                : "Clicks through your app and captures every frame. Downloaded on first run."
            }
            icon={
              <AppIcon>
                <ChromiumLogo />
              </AppIcon>
            }
            name="Chromium"
            status={status?.chromium.ready ? <ReadyLabel /> : null}
          />
          <ToolRow
            action={
              !ready && !busy && ffmpeg?.installable ? (
                <Button className="pr-2.5" onClick={startInstall}>
                  <DownloadGlyph /> {install.phase === "error" ? "Try again" : "Install ffmpeg"}
                </Button>
              ) : null
            }
            beam={ready ? "success" : busy ? "active" : "idle"}
            detail={
              ready && ffmpeg
                ? ffmpegReadyDetail(ffmpeg)
                : partial
                  ? `The ffmpeg on this computer is missing ${ffmpeg.missingEncoders.join(" and ")}. vaunt can install its own copy alongside it. ${size}`
                  : `Turns recordings into smooth previews and encodes your exports. ${size}`
            }
            icon={
              <AppIcon>
                <FfmpegLogo />
              </AppIcon>
            }
            name="ffmpeg"
            status={
              ready ? (
                <ReadyLabel />
              ) : status && !busy ? (
                <span className="flex items-center gap-1 text-sm text-warning-foreground">
                  <CircleAlertIcon className="size-3.5" /> {partial ? "Missing encoders" : "Not installed"}
                </span>
              ) : null
            }>
            {busy && (
              <div className="flex flex-col gap-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
                  <div
                    className="h-full origin-left rounded-full bg-info transition-transform duration-150 ease-out"
                    style={{
                      transform: `scaleX(${install.phase === "verifying" ? 1 : total ? install.received / total : 0.04})`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-muted-foreground text-xs tabular-nums">
                  <span className="flex items-center gap-1.5">
                    <LoaderIcon className="size-3 animate-spin motion-reduce:animate-none" />
                    {install.phase === "verifying"
                      ? "Checking encoders: libx264, libwebp…"
                      : "Downloading ffmpeg…"}
                  </span>
                  {install.phase === "downloading" && (
                    <span>
                      {megabytes(install.received)}
                      {total ? ` of ${megabytes(total)}` : ""} MB
                    </span>
                  )}
                </div>
              </div>
            )}
            {install.phase === "error" && (
              <p className="flex items-start gap-1.5 text-destructive-foreground text-sm" role="alert">
                <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                {install.message}
              </p>
            )}
            <ul className="flex flex-wrap gap-1.5">
              {UNLOCKS.map((unlock) => (
                <li
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors duration-300",
                    ready ? "bg-success/12 text-success-foreground" : "bg-white/5 text-muted-foreground"
                  )}
                  key={unlock}>
                  {ready ? (
                    <CheckIcon className="size-3" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-current opacity-50" />
                  )}
                  {unlock}
                </li>
              ))}
            </ul>
            {!ready && !busy && <BrewCommand copied={copied} onCopy={() => copy(BREW_COMMAND)} />}
          </ToolRow>
        </div>
      }
    />
  );
}

const BREW_COMMAND = "brew install ffmpeg";

/**
 * The Homebrew alternative as the command itself, ready to copy: a terminal-style chip you press. On copy the icon
 * swaps to a check (scale, opacity and a little blur, so the two icons read as one morphing) and the chip's ring
 * turns green for as long as the check shows; screen readers hear "Copied".
 */
function BrewCommand({ copied, onCopy }: { copied: boolean; onCopy: () => void }): React.ReactElement {
  const swap =
    "absolute inset-0 transition-[opacity,scale,filter] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-muted-foreground text-sm">
      <span>Rather use Homebrew?</span>
      <button
        aria-label={`Copy ${BREW_COMMAND}`}
        className={cn(
          "group/brew relative inline-flex h-8 cursor-pointer select-none items-center before:absolute before:inset-x-0 before:-inset-y-1 gap-2 rounded-lg bg-white/[0.04] pr-2 pl-2.5 font-mono text-[13px] text-foreground/85 outline-none transition-[background-color,box-shadow,scale] duration-150 ease-out hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] motion-reduce:transition-none",
          // The border beam's success green (#4ade80, its mint highlight #a7f3d0), so a copy reads like the AI cards.
          copied
            ? "shadow-[0_0_0_1px_rgb(74_222_128/0.6),0_0_14px_-2px_rgb(74_222_128/0.35)]"
            : "shadow-[0_0_0_1px_rgb(255_255_255/0.08)] hover:shadow-[0_0_0_1px_rgb(255_255_255/0.14)]"
        )}
        onClick={onCopy}
        type="button">
        <span aria-hidden="true" className="text-muted-foreground/60">
          $
        </span>
        {BREW_COMMAND}
        <span
          aria-hidden="true"
          className="relative ml-0.5 size-3.5 text-muted-foreground group-hover/brew:text-foreground">
          <CopyIcon
            className={cn(swap, copied ? "scale-50 opacity-0 blur-[2px]" : "scale-100 opacity-100 blur-0")}
          />
          <CheckIcon
            className={cn(
              swap,
              "text-[#4ade80]",
              copied ? "scale-100 opacity-100 blur-0" : "scale-50 opacity-0 blur-[2px]"
            )}
          />
        </span>
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </div>
  );
}

function DownloadGlyph(): React.ReactElement {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24">
      <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* -------------------------------------------------------------- the window ------------------------------------------------------------- */

const STEPS = ["Welcome", "The studio", "Your media", "Setup"];

/** How long a leaving slide stays mounted: its copy's exit plus the stagger (see onboarding.css). */
const LEAVE_MS = 380;

/** The welcome slide moves on by itself: once its copy has landed, after this long. */
const WELCOME_HOLD_MS = 4000;
/** When the welcome copy has finished landing: the line's delay plus Focus Blur Resolve's 760ms. */
const WELCOME_SETTLED_MS = BODY_DELAY_MS + 760;

/** Static film grain: fractal noise, desaturated, tiled. */
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>'
)}")`;
const GITHUB_URL = "https://github.com/cosscom/coss-vaunt";
// TODO: confirm the X handle before this ships.
const X_URL = "https://x.com/cossdotcom";

/** The window's base colour, which the glow lifts toward white. */
const BASE_RGB = [9, 9, 11];

/** The glow, as tuned: strength over the base peak, the ellipse's radii as shares of the window, its centre height. */
const GLOW = { strength: 1.3, width: 0.78, height: 0.48, centre: 0.5 };

/**
 * The central glow, drawn per pixel instead of as a CSS gradient. A faint white glow over near-black has only ~25
 * 8-bit levels to spread across hundreds of pixels, so a CSS (or SVG) gradient steps into visible rings, and its
 * straight segments between stops leave knees. Here the falloff is a smooth Gaussian, and each pixel gets
 * triangular dither of about one level before it's rounded, so the steps dissolve into noise the eye can't see.
 * Drawn once at device resolution, again on resize or when the controls change.
 */
function GlowBackdrop(): React.ReactElement {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const surface = canvas.current;
    const context = surface?.getContext("2d");
    if (!surface || !context) return;
    let frame = 0;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(surface.clientWidth * dpr));
      const height = Math.max(1, Math.round(surface.clientHeight * dpr));
      surface.width = width;
      surface.height = height;
      const { strength, width: rw, height: rh, centre } = GLOW;
      const image = context.createImageData(width, height);
      const data = image.data;
      // Same shape as the CSS it replaces: an ellipse with radii of rw × width and rh × height, peaking at 7.5%
      // white × strength, a Gaussian that passes 40% of the peak at 0.45 of the radius, eased to zero by 1.15.
      const peak = 0.075 * strength;
      const cx = width / 2;
      const cy = height * centre;
      const ax = 1 / (rw * width);
      const ay = 1 / (rh * height);
      for (let y = 0; y < height; y++) {
        const dy = (y - cy) * ay;
        for (let x = 0; x < width; x++) {
          const dx = (x - cx) * ax;
          const r2 = dx * dx + dy * dy;
          const r = Math.sqrt(r2);
          const fade =
            r < 0.85 ? 1 : r > 1.15 ? 0 : 1 - ((r - 0.85) / 0.3) ** 2 * (3 - 2 * ((r - 0.85) / 0.3));
          const alpha = peak * Math.exp(-4.5 * r2) * fade;
          const dither = Math.random() + Math.random() - 1;
          const i = (y * width + x) * 4;
          data[i] = BASE_RGB[0] + alpha * (255 - BASE_RGB[0]) + dither;
          data[i + 1] = BASE_RGB[1] + alpha * (255 - BASE_RGB[1]) + dither;
          data[i + 2] = BASE_RGB[2] + alpha * (255 - BASE_RGB[2]) + dither;
          data[i + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };
    draw();
    const observer = new ResizeObserver(schedule);
    observer.observe(surface);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);
  return (
    <canvas
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 size-full"
      ref={canvas}
    />
  );
}

/**
 * The onboarding window. Enter continues (as on every Raycast slide); the back button and the step bar go anywhere.
 * `onFinish` runs when the user leaves the last slide, whether ffmpeg is in or they skipped it.
 */
export function Onboarding({ onFinish }: { onFinish: () => void }): React.ReactElement {
  const [step, setStep] = useState(0);
  // Owned here, not by the setup slide, so a download keeps going if the user steps back a slide.
  const tools = useSetupTools();
  // Auto-advance runs once, from the first visit to the welcome slide; any click or key hands control back.
  const [autoAdvance, setAutoAdvance] = useState(step === 0);
  const countdown = useRef<HTMLSpanElement>(null);

  // Slides on screen: the current one, plus the one leaving while its copy animates out. Keyed by step, so the
  // leaving slide is the same instance (its demos and canvas carry on) rather than a fresh copy.
  // `delayed` is fixed when a slide mounts: it waits for the outgoing copy. (Deriving it from whether another slide
  // is still leaving would drop the delay mid-entrance and make the copy jump.)
  const [layers, setLayers] = useState<{ step: number; leaving: boolean; delayed: boolean }[]>(() => [
    { step, leaving: false, delayed: false },
  ]);
  // +1 forward, -1 back: copy leaves and arrives along the direction of travel.
  const [direction, setDirection] = useState(1);
  const leaveTimer = useRef(0);

  const go = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, next));
    setStep((current) => {
      if (clamped === current) return current;
      setDirection(clamped > current ? 1 : -1);
      const animate = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      setLayers((previous) => [
        ...(animate
          ? previous.filter((layer) => layer.step !== clamped).map((layer) => ({ ...layer, leaving: true }))
          : []),
        { step: clamped, leaving: false, delayed: animate },
      ]);
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = window.setTimeout(
        () => setLayers((previous) => previous.filter((layer) => !layer.leaving)),
        LEAVE_MS
      );
      return clamped;
    });
  }, []);

  const last = step === STEPS.length - 1;
  const installed = Boolean(tools.status?.ffmpeg.ready);
  // The last slide is setup: until ffmpeg is in, installing is the primary action and finishing is the quiet one.
  const continueQuiet = last && !installed;
  const continueLabel = last ? (installed ? "Open the studio" : "Skip for now") : "Continue";
  const onContinue = useCallback(() => (last ? onFinish() : go(step + 1)), [go, last, onFinish, step]);

  useEffect(() => {
    if (step !== 0 || !autoAdvance) return;
    const stop = () => setAutoAdvance(false);
    window.addEventListener("pointerdown", stop);
    window.addEventListener("keydown", stop);
    let raf = 0;
    let last = 0;
    let elapsed = 0;
    const tick = (now: number) => {
      if (!document.hidden) elapsed += last ? Math.min(64, now - last) * motion.speed : 0;
      last = now;
      const progress = Math.min(1, Math.max(0, (elapsed - WELCOME_SETTLED_MS) / WELCOME_HOLD_MS));
      if (countdown.current) countdown.current.style.transform = `scaleX(${progress})`;
      if (progress >= 1) {
        setAutoAdvance(false);
        go(1);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [autoAdvance, go, step]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (/^(BUTTON|A|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return;
      event.preventDefault();
      onContinue();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, onContinue]);

  return (
    <div className="dark fixed inset-0 isolate flex flex-col bg-[#09090b] text-foreground antialiased">
      {/* Raycast's backdrop: a soft elliptical light in the middle, and film grain over everything (which also
          dithers the gradient, so it doesn't band). Both are inert. */}
      <GlowBackdrop />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 mix-blend-overlay"
        style={{
          backgroundImage: GRAIN,
          backgroundSize: "400px 400px",
          opacity: 0.4,
        }}
      />
      <div aria-hidden="true" className="h-10 shrink-0" />
      <main className="relative min-h-0 flex-1" style={{ "--dir": direction } as React.CSSProperties}>
        {layers.map((layer) => (
          <div
            aria-hidden={layer.leaving || undefined}
            className={cn("absolute inset-0", layer.leaving && "pointer-events-none")}
            data-entering={layer.delayed ? "" : undefined}
            data-leaving={layer.leaving ? "" : undefined}
            inert={layer.leaving}
            key={layer.step}>
            {layer.step === 0 && <WelcomeSlide />}
            {layer.step === 1 && <Bento />}
            {layer.step === 2 && <TileWalk />}
            {layer.step === 3 && <SetupSlide tools={tools} />}
          </div>
        ))}
      </main>
      <footer className="flex shrink-0 items-center gap-5 px-4 pt-3 pb-4">
        <Button
          aria-label="Back"
          // Round the button's highlight layer too (coss-ui draws it with the default corner radius, which showed as a
          // square behind the circle). It slides in from the right when there's somewhere to go back to, and leaves
          // faster than it came.
          className={cn(
            "rounded-full before:rounded-full transition-[opacity,translate,filter,visibility] motion-reduce:transition-none",
            step === 0
              ? "invisible translate-x-[15px] opacity-0 blur-[1px] duration-150 ease-in"
              : "visible translate-x-0 opacity-100 blur-0 duration-[420ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
          )}
          disabled={step === 0}
          onClick={() => go(step - 1)}
          size="icon-lg"
          variant="outline">
          <ArrowLeftIcon />
        </Button>
        <nav aria-label="Onboarding steps" className="flex items-center gap-1">
          {STEPS.map((label, i) => (
            <button
              aria-current={i === step ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${label}`}
              className="group relative flex h-10 cursor-pointer items-center px-0.5"
              key={label}
              onClick={() => go(i)}
              type="button">
              <span
                className={cn(
                  "relative block h-1 overflow-hidden rounded-full transition-[width,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  i === step
                    ? "w-12 bg-info shadow-[0_0_10px_0_color-mix(in_oklab,var(--info)_55%,transparent),0_0_2px_0_color-mix(in_oklab,var(--info)_80%,transparent)]"
                    : "w-4 bg-white/16 group-hover:bg-white/28"
                )}>
                {/* The welcome slide's countdown to moving on: white filling the blue. */}
                {i === 0 && step === 0 && autoAdvance && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 origin-left rounded-full bg-white"
                    ref={countdown}
                    style={{ transform: "scaleX(0)" }}
                  />
                )}
              </span>
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Button
            className="h-10 rounded-full px-3 text-muted-foreground hover:text-foreground"
            aria-label="Follow on X"
            render={<a href={X_URL} rel="noreferrer" target="_blank" />}
            variant="ghost">
            Follow on
            <XMark aria-hidden="true" className="size-3.5" />
          </Button>
          <Button
            className="h-10 rounded-full px-3 text-muted-foreground hover:text-foreground"
            render={<a href={GITHUB_URL} rel="noreferrer" target="_blank" />}
            variant="ghost">
            <GithubIcon />
            Star on GitHub
          </Button>
        </div>
        <Button
          className="ml-2 h-10 rounded-full pr-2 pl-4 text-[15px]"
          onClick={onContinue}
          variant={continueQuiet ? "outline" : "default"}>
          {continueLabel}
          <Kbd className="ml-1">
            <CornerDownLeftIcon className="size-3" />
          </Kbd>
        </Button>
      </footer>
    </div>
  );
}
