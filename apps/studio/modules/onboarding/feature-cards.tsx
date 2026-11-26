"use client";

// The onboarding's feature cards: each one a live demo built from the studio's own components and catalogues.
import { Badge } from "@coss/ui/components/badge";
import {
  BoxIcon,
  CaptionsIcon,
  CheckIcon,
  DownloadIcon,
  FileIcon,
  FileTextIcon,
  LayersIcon,
  MonitorIcon,
  MusicIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  VideoIcon,
} from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import {
  MOTION_PRESETS,
  type MotionPreset,
} from "@coss/vaunt-engine/catalogues/motion-presets/motion-presets";
import type { TextEffect } from "@coss/vaunt-engine/catalogues/text-effects/text-effect";
import { getTextEffect } from "@coss/vaunt-engine/catalogues/text-effects/text-effect-catalogue";
import { EASE_PRESETS } from "@coss/vaunt-engine/storyboard/ease-presets";
import type { CubicPoints } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type * as React from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ClaudeMark } from "./brand-marks";
import frameHome from "./frames/frame-1.jpg";
import frameGreeting from "./frames/frame-3.jpg";
import frameLinks from "./frames/frame-6.jpg";
import frameEndCard from "./frames/frame-7.jpg";
import { BorderBeam } from "@/modules/border-beam/border-beam";
import { CARD_BEAM } from "@/modules/border-beam/border-beam-engine";
import { CurveEditor } from "@/modules/editor/easing/curve-editor";
import { easeLabel } from "@/modules/editor/easing/easing-copy";
import { RotationSphere } from "@/modules/editor/inspector/rotation-sphere";
import { motionPreviewFrames } from "@/modules/editor/motion/motion-preview";

/* ---------------------------------------------------------------- time ---------------------------------------------------------------- */

/** The control panel's speed multiplier; every loop below reads it each frame. */
export const motion = { speed: 1 };

const reducedQuery = "(prefers-reduced-motion: reduce)";
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = matchMedia(reducedQuery);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => matchMedia(reducedQuery).matches,
    () => false
  );
}

/**
 * Calls `frame(progress, seconds)` every animation frame, `progress` running 0→1 over `periodMs` and wrapping.
 * Time stops while the tab is hidden or `paused`; with reduced motion it draws one still at `still`.
 */
export function useLoop(
  periodMs: number,
  frame: (progress: number, seconds: number) => void,
  { paused = false, still = 0.4 }: { paused?: boolean; still?: number } = {}
): void {
  const reduced = useReducedMotion();
  const callback = useRef(frame);
  callback.current = frame;
  const elapsed = useRef(0);
  useEffect(() => {
    if (reduced) {
      callback.current(still, (still * periodMs) / 1000);
      return;
    }
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 0;
      last = now;
      if (!paused && !document.hidden) elapsed.current += dt * motion.speed;
      callback.current((elapsed.current % periodMs) / periodMs, elapsed.current / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [periodMs, paused, reduced, still]);
}

/** A React-state version of `useLoop` for components that render from props. */
export function useLoopValue(periodMs: number, options?: { paused?: boolean; still?: number }): number {
  const [value, setValue] = useState(options?.still ?? 0);
  useLoop(periodMs, (progress) => setValue(progress), options);
  return value;
}

/** CSS cubic-bezier timing: solve x(t) = progress by bisection, return y(t). */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): (progress: number) => number {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (progress) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < progress) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** 0→1 across [start, end] of a loop's progress. */
export const span = (p: number, start: number, end: number) => clamp01((p - start) / (end - start));
const preset = (family: string, direction: string) =>
  EASE_PRESETS.find((p) => p.family === family && p.direction === direction)?.cubic as CubicPoints;
const curve = (points: CubicPoints) => cubicBezier(...points);
export const easeInOut = curve(preset("quart", "in-out"));
export const easeOut = curve(preset("expo", "out"));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ---------------------------------------------------------------- card ---------------------------------------------------------------- */

/**
 * The Raycast-style card: icon tile, title, one line on what it does, a hairline, then the live demo filling the
 * rest. Ring shadow, not a border (dark surfaces), and the demo area clips to the card's inner radius.
 */
export function FeatureCard({
  feature,
  className,
  paused,
  style,
}: {
  feature: Feature;
  className?: string;
  paused?: boolean;
  style?: React.CSSProperties;
}): React.ReactElement {
  const { Icon, title, description, Demo } = feature;
  return (
    <article
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl bg-[color-mix(in_oklab,var(--background),white_3%)] shadow-[0_0_0_1px_rgb(255_255_255/0.07),0_1px_0_rgb(255_255_255/0.04)_inset,0_12px_32px_-12px_rgb(0_0_0/0.6)]",
        className
      )}
      style={style}>
      <header className="flex items-start gap-3 px-4 pt-4 pb-3.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-white/12 to-white/4 shadow-[0_0_0_1px_rgb(255_255_255/0.08)]">
          <Icon className="size-4 text-foreground/90" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="font-medium text-[15px] text-foreground leading-6">{title}</h3>
          <p className="text-pretty text-muted-foreground text-sm leading-5">{description}</p>
        </div>
      </header>
      <div className="mx-4 h-px bg-white/6" />
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-b-2xl">
        <Demo paused={paused} />
      </div>
    </article>
  );
}

/* --------------------------------------------------------------- demos ---------------------------------------------------------------- */

// Stills from a real recording, bundled with the code (hashed into the build), so the cards need no server path,
// no ~/.vaunt project and no app running.
const FRAME_HOME = frameHome.src;
const FRAME_LINKS = frameLinks.src;

/** The recorded app as a device: rounded screen, hairline, a contact shadow on the floor that follows the tilt. */
function Device({
  rotateX,
  rotateY,
  rotateZ,
  src = FRAME_LINKS,
  className,
}: {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  src?: string;
  className?: string;
}): React.ReactElement {
  return (
    <div className={cn("relative [perspective:900px]", className)}>
      <div
        className="absolute inset-x-[8%] -bottom-[10%] h-[18%] rounded-[50%] bg-black/70 blur-xl"
        style={{ transform: `translateX(${rotateY * 0.6}%) scaleX(${1 - Math.abs(rotateY) / 180})` }}
      />
      <div
        className="relative aspect-[1440/900] w-full [transform-style:preserve-3d]"
        style={{ transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)` }}>
        {/* biome-ignore lint/performance/noImgElement: a fixed-size still inside an animated card; next/image adds nothing here */}
        <img
          alt="Cal.com, recorded by vaunt"
          className="size-full rounded-[7px] object-cover outline-1 outline-white/10 -outline-offset-1"
          draggable={false}
          src={src}
        />
        <div className="pointer-events-none absolute inset-0 rounded-[7px] bg-gradient-to-br from-white/10 via-transparent to-transparent" />
      </div>
    </div>
  );
}

const ORBIT: [number, number, number][] = [
  [8, -24, 0],
  [-6, 18, -3],
  [14, 6, 2],
  [0, -10, 0],
];

/** The inspector's real rotation sphere driving the device. It tours a few poses until you grab it. */
function StageDemo({ paused }: { paused?: boolean }): React.ReactElement {
  const [manual, setManual] = useState<null | { rotateX: number; rotateY: number; rotateZ: number }>(null);
  const [auto, setAuto] = useState({ rotateX: 8, rotateY: -24, rotateZ: 0 });
  useLoop(
    ORBIT.length * 2600,
    (p) => {
      const at = p * ORBIT.length;
      const i = Math.floor(at);
      // Hold each pose for a beat, then ease to the next one: an in-out curve, since it moves while on screen.
      const t = easeInOut(span(at - i, 0.35, 1));
      const [ax, ay, az] = ORBIT[i];
      const [bx, by, bz] = ORBIT[(i + 1) % ORBIT.length];
      setAuto({ rotateX: lerp(ax, bx, t), rotateY: lerp(ay, by, t), rotateZ: lerp(az, bz, t) });
    },
    { paused: paused || manual !== null, still: 0 }
  );
  const pose = manual ?? auto;
  const round = (v: number) => Math.round(v);
  return (
    <div className="@container size-full">
      <div className="flex size-full items-center gap-5 px-5 py-4">
        <Device className="min-w-0 flex-1" {...pose} />
        <div className="w-28 shrink-0 @[560px]:w-[264px] @max-[559px]:[&>div>div:last-child]:hidden">
          <RotationSphere
            keyframes={{ rotateX: "none", rotateY: "none", rotateZ: "none" }}
            onChange={(key, value) => setManual({ ...pose, [key]: value })}
            onReset={() => setManual(null)}
            onToggleKeyframe={() => undefined}
            rotateX={round(pose.rotateX)}
            rotateY={round(pose.rotateY)}
            rotateZ={round(pose.rotateZ)}
          />
        </div>
      </div>
    </div>
  );
}

const EASE_TOUR: CubicPoints[] = [
  preset("expo", "out"),
  preset("back", "out"),
  preset("quart", "in-out"),
  preset("circ", "out"),
  preset("back", "in-out"),
];

/** The editor's real curve editor: it morphs through presets with the preview dot riding the curve. Drag a handle to take over. */
function EasingDemo({ paused }: { paused?: boolean }): React.ReactElement {
  const [manual, setManual] = useState<CubicPoints | null>(null);
  const [state, setState] = useState<{ points: CubicPoints; x: number; index: number }>({
    points: EASE_TOUR[0],
    x: 0,
    index: 0,
  });
  useLoop(
    EASE_TOUR.length * 2400,
    (p) => {
      const at = p * EASE_TOUR.length;
      const i = Math.floor(at);
      const local = at - i;
      const from = EASE_TOUR[i];
      const to = EASE_TOUR[(i + 1) % EASE_TOUR.length];
      // Ride the curve for the first 70%, then morph to the next preset.
      const morph = easeInOut(span(local, 0.74, 1));
      const points = from.map((v, k) => lerp(v, to[k], morph)) as CubicPoints;
      setState({ points, x: span(local, 0.04, 0.64), index: morph > 0.5 ? (i + 1) % EASE_TOUR.length : i });
    },
    { paused: paused || manual !== null, still: 0.3 }
  );
  const points = manual ?? state.points;
  const y = curve(points)(state.x);
  return (
    <div className="@container size-full">
      <div className="flex size-full items-center gap-4 px-5 py-4 @max-[420px]:flex-col @max-[420px]:items-stretch @max-[420px]:gap-2">
        <div className="aspect-square h-full max-h-[200px] min-h-0 min-w-0 @max-[420px]:mx-auto @max-[420px]:flex-1">
          <CurveEditor
            disabled={false}
            onChange={(next) => setManual(next)}
            points={points}
            preview={{ x: state.x, y }}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <span className="w-fit rounded-md bg-white/6 px-2 py-1 font-medium text-foreground text-xs">
            {manual ? "Custom" : easeLabel({ cubic: EASE_TOUR[state.index] })}
          </span>
          <div className="relative h-7 rounded-full bg-white/4 shadow-[0_0_0_1px_rgb(255_255_255/0.05)_inset]">
            {/* The rail is the track less one dot, so translating it by its own width lands the dot at the end. */}
            <span
              className="absolute inset-y-1 left-1 right-7"
              style={{ transform: `translateX(${y * 100}%)` }}>
              <span className="absolute top-0 left-0 size-5 rounded-full bg-info shadow-[0_0_16px_var(--info)]" />
            </span>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
            cubic-bezier({points.map((v) => v.toFixed(2)).join(", ")})
          </p>
        </div>
      </div>
    </div>
  );
}

const CLIPS = [
  { name: "Congrats greeting", seconds: 3, src: frameGreeting.src },
  { name: "Open Links from sidebar", seconds: 5, src: FRAME_LINKS },
  { name: "End card", seconds: 3, src: frameEndCard.src },
];
const TOTAL = CLIPS.reduce((sum, clip) => sum + clip.seconds, 0);
const BARS = Array.from(
  { length: 64 },
  (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.31))
);
const timecode = (s: number) =>
  `00:${String(Math.floor(s)).padStart(2, "0")}.${String(Math.floor((s % 1) * 100)).padStart(2, "0")}`;

/** A real-length cut of the project you saw: three clips, a music bed, the playhead sweeping at real speed. */
function TimelineDemo({ paused }: { paused?: boolean }): React.ReactElement {
  const playhead = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  useLoop(
    TOTAL * 1000,
    (p) => {
      if (playhead.current) playhead.current.style.left = `${p * 100}%`;
      if (readout.current) readout.current.textContent = timecode(p * TOTAL);
    },
    { paused, still: 0.42 }
  );
  return (
    <div className="flex size-full flex-col gap-2 px-4 py-3.5">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>
          <span className="text-foreground" ref={readout}>
            00:00.00
          </span>{" "}
          / {timecode(TOTAL)}
        </span>
        <span>60 fps</span>
      </div>
      <div className="relative flex flex-1 flex-col gap-1.5">
        <div className="flex h-3 items-end justify-between border-white/8 border-b pb-0.5">
          {Array.from({ length: TOTAL + 1 }, (_, i) => (
            <span className={cn("w-px bg-white/20", i % 2 ? "h-1" : "h-2")} key={`tick-${i}`} />
          ))}
        </div>
        <div className="flex h-[46%] min-h-10 gap-1">
          {CLIPS.map((clip) => (
            <div
              className="relative flex min-w-0 overflow-hidden rounded-md bg-white/5 shadow-[0_0_0_1px_rgb(255_255_255/0.08)_inset]"
              key={clip.name}
              style={{ flex: clip.seconds }}>
              {/* biome-ignore lint/performance/noImgElement: a fixed-size still inside an animated card; next/image adds nothing here */}
              <img alt="" className="h-full w-auto shrink-0 object-cover opacity-70" src={clip.src} />
              <span className="absolute inset-x-1.5 bottom-1 truncate text-[10px] text-white/90">
                {clip.name}
              </span>
            </div>
          ))}
        </div>
        <div className="flex h-7 items-center gap-[2px] rounded-md bg-success/8 px-1.5 shadow-[0_0_0_1px_rgb(255_255_255/0.05)_inset]">
          {BARS.map((h, i) => (
            <span
              className="flex-1 rounded-full bg-success/60"
              key={`bar-${i}`}
              style={{ height: `${h * 70}%` }}
            />
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-white shadow-[0_0_8px_white]"
          ref={playhead}>
          <span className="absolute -top-1 -left-[3px] size-[7px] rotate-45 rounded-[1px] bg-white" />
        </div>
      </div>
    </div>
  );
}

/** Chromium clicking through your app: the cursor glides to Links, clicks, and the page changes under it. */
function RecordDemo({ paused }: { paused?: boolean }): React.ReactElement {
  const [p, setP] = useState(0.1);
  useLoop(6400, setP, { paused, still: 0.75 });
  // Glide in-out (it moves on screen), press, then the next page lands.
  const travel = easeInOut(span(p, 0.12, 0.42));
  const x = lerp(62, 5.2, travel);
  const y = lerp(58, 12.6, travel);
  const press = p > 0.44 && p < 0.5;
  const ripple = span(p, 0.45, 0.62);
  const onLinks = p > 0.5;
  const seconds = p * 6.4;
  // The camera, as vaunt's would: wide, push in toward the click, then settle back out on the new page.
  const zoom = lerp(lerp(1.6, 2.6, easeInOut(span(p, 0.08, 0.44))), 1.6, easeInOut(span(p, 0.62, 0.95)));
  return (
    <div className="flex size-full flex-col px-4 py-3.5">
      <div className="flex items-center gap-2 rounded-t-lg bg-white/6 px-2.5 py-1.5">
        <span className="flex gap-1">
          {["a", "b", "c"].map((k) => (
            <span className="size-1.5 rounded-full bg-white/20" key={k} />
          ))}
        </span>
        <span className="flex-1 truncate rounded bg-black/30 px-2 py-0.5 text-[10px] text-muted-foreground">
          localhost:3000/{onLinks ? "event-types" : "home"}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-destructive/16 px-1.5 py-0.5 font-medium text-[10px] text-red-300 tabular-nums">
          <span className="size-1.5 animate-pulse rounded-full bg-red-400 motion-reduce:animate-none" />
          {timecode(seconds)}
        </span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-b-lg bg-black">
        <div
          className="absolute top-0 left-0 aspect-[1440/900] w-full origin-top-left"
          style={{ transform: `scale(${zoom})` }}>
          {/* biome-ignore lint/performance/noImgElement: a fixed-size still inside an animated card; next/image adds nothing here */}
          <img alt="" className="absolute inset-0 size-full object-cover object-left-top" src={FRAME_HOME} />
          {/* biome-ignore lint/performance/noImgElement: a fixed-size still inside an animated card; next/image adds nothing here */}
          <img
            alt=""
            className="absolute inset-0 size-full object-cover object-left-top transition-opacity duration-200 ease-out"
            src={FRAME_LINKS}
            style={{ opacity: onLinks ? 1 : 0 }}
          />
          <span
            className="pointer-events-none absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              opacity: ripple > 0 && ripple < 1 ? 1 - ripple : 0,
              scale: (0.4 + ripple) / zoom,
            }}
          />
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute size-4 drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)] transition-[scale] duration-100"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              scale: (press ? 0.86 : 1) / zoom,
              transformOrigin: "top left",
            }}
            viewBox="0 0 16 16">
            <path d="M2 1.5v12l3.2-3.1 2.1 4.6 2-1-2.1-4.5H12z" fill="white" stroke="black" strokeWidth="1" />
          </svg>
        </div>
      </div>
    </div>
  );
}

type SceneState = "done" | "recording" | "queued";
const SCENES = [
  { title: "Congrats greeting", summary: "Hi Anik, congrats on the launch", seconds: 3 },
  { title: "Open Links from sidebar", summary: "Home, then Links in the sidebar", seconds: 5 },
  { title: "End card", summary: "Here's to what's next, Anik!", seconds: 3 },
];

/** The storyboard's scene cards with the real border beam: each scene records, turns green, hands on. */
function StoryboardDemo({ paused }: { paused?: boolean }): React.ReactElement {
  const [p, setP] = useState(0.4);
  useLoop(9000, setP, { paused, still: 0.4 });
  const active = Math.min(SCENES.length, Math.floor(p * (SCENES.length + 1)));
  const state = (i: number): SceneState => (i < active ? "done" : i === active ? "recording" : "queued");
  return (
    <div className="flex size-full flex-col items-center justify-center gap-0 px-4 py-3">
      <p className="mb-3 flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
        <ClaudeMark className="size-3 text-foreground/80" />
        {active < SCENES.length
          ? `Claude is recording scene ${active + 1} of ${SCENES.length}…`
          : "Claude recorded all 3 scenes"}
      </p>
      {SCENES.map((scene, i) => (
        <div className="flex flex-col items-center" key={scene.title}>
          {i > 0 && <span className="h-3 w-px bg-white/15" />}
          <BorderBeam
            options={CARD_BEAM}
            state={
              state(i) === "recording"
                ? "active"
                : state(i) === "done" && i === active - 1
                  ? "success"
                  : "idle"
            }>
            <div className="flex w-[232px] flex-col gap-0.5 rounded-xl border bg-card px-3 py-2">
              <div className="flex items-center gap-2">
                <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium text-foreground text-xs">{scene.title}</span>
                <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                  {scene.seconds} s
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="truncate text-[11px] text-muted-foreground">{scene.summary}</span>
                <Badge
                  className="ml-auto shrink-0"
                  size="sm"
                  variant={state(i) === "done" ? "success" : state(i) === "recording" ? "info" : "outline"}>
                  {state(i) === "done" ? "Done" : state(i) === "recording" ? "Recording" : "Queued"}
                </Badge>
              </div>
            </div>
          </BorderBeam>
        </div>
      ))}
    </div>
  );
}

/** An export from start to Downloads: frames encode, the bar fills, the file lands. */
function ExportDemo({ paused }: { paused?: boolean }): React.ReactElement {
  const [p, setP] = useState(0.5);
  useLoop(7000, setP, { paused, still: 0.55 });
  const progress = easeOut(span(p, 0.06, 0.74));
  const done = p > 0.78;
  const frames = Math.round(progress * 660);
  return (
    <div className="flex size-full flex-col justify-center gap-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-white/6 shadow-[0_0_0_1px_rgb(255_255_255/0.06)_inset]">
          {done ? (
            <CheckIcon className="size-4 text-success" />
          ) : (
            <VideoIcon className="size-4 text-muted-foreground" />
          )}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-foreground text-sm">Launch video.mp4</span>
          <span className="text-muted-foreground text-xs">1920 × 1080 · 60 fps · H.264</span>
        </div>
        <span className="ml-auto font-medium text-foreground text-sm tabular-nums">
          {Math.round(progress * 100)}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
        <div
          className={cn("h-full origin-left rounded-full", done ? "bg-success" : "bg-info")}
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      <div className="flex justify-between text-muted-foreground text-xs tabular-nums">
        <span>{done ? "Saved to Downloads" : `Encoding frame ${frames} of 660`}</span>
        <span className="flex items-center gap-1">
          <DownloadIcon className="size-3" />
          18.4 MB
        </span>
      </div>
    </div>
  );
}

type TextSpec = TextEffect;
type Pose = TextEffect["enter"]["from"];
const effect = (id: string): TextEffect => {
  const found = getTextEffect(id);
  if (!found) throw new Error(`No text effect ${id} in the catalogue`);
  return found;
};
const TEXT_SPECS = [
  "stagger-from-edges",
  "per-character-rise",
  "soft-blur-in",
  "depth-parallax-words",
  "spring-scale-in",
].map(effect);
const parseCubic = (css: string) =>
  cubicBezier(...((css.match(/-?[\d.]+/g) ?? []).map(Number) as CubicPoints));
export const TEXT_EFFECTS = {
  softBlurIn: effect("soft-blur-in"),
  focusBlurResolve: effect("focus-blur-resolve"),
};

/** Which beat of the stagger unit `i` of `count` starts on, per the effect's stagger mode. */
function staggerOrder(spec: TextSpec, i: number, count: number): number {
  if (spec.target === "whole") return 0;
  switch (spec.staggerMode) {
    case "reverse":
      return count - 1 - i;
    case "edges-in":
      return Math.min(i, count - 1 - i);
    case "center-out":
      return Math.round(Math.abs(i - (count - 1) / 2));
    default:
      return i;
  }
}

/** Where unit `i` of `count` is, `ms` into a spec's enter: its stagger, its easing, its from→to. */
function effectPose(spec: TextSpec, i: number, count: number, ms: number): React.CSSProperties {
  const order = staggerOrder(spec, i, count);
  const t = parseCubic(spec.enter.easing)(span(ms - order * spec.enter.staggerMs, 0, spec.enter.durationMs));
  const { from, to } = spec.enter;
  const v = (k: keyof Pose, fallback: number) =>
    lerp(from[k] ?? fallback, to[k] ?? fallback, t) * (k === "y_px" ? spec.yTravelMultiplier : 1);
  const blur = v("blur_px", 0);
  return {
    opacity: v("opacity", 1),
    transform: `translate(${v("x_px", 0)}px, ${v("y_px", 0)}px) scale(${v("scale", 1)})`,
    filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
  };
}

/**
 * Text entering with one of the studio's text effects, once. Letters stay grouped in their words so lines only
 * break between words; screen readers get the plain text.
 */
export function EffectText({
  text,
  spec,
  delayMs = 0,
  as: Tag = "p",
  className,
}: {
  text: string;
  spec: TextSpec;
  delayMs?: number;
  as?: "p" | "h1" | "h2";
  className?: string;
}): React.ReactElement {
  const reduced = useReducedMotion();
  const words = text.split(" ");
  const perChar = spec.target === "per-character";
  const count = perChar ? words.join("").length : spec.target === "per-word" ? words.length : 1;
  const total = delayMs + (count - 1) * spec.enter.staggerMs + spec.enter.durationMs;
  const [ms, setMs] = useState(reduced ? Number.POSITIVE_INFINITY : 0);
  useEffect(() => {
    if (reduced) {
      setMs(Number.POSITIVE_INFINITY);
      return;
    }
    let raf = 0;
    let last = 0;
    let elapsed = 0;
    const tick = (now: number) => {
      elapsed += last ? Math.min(64, now - last) * motion.speed : 0;
      last = now;
      setMs(elapsed);
      if (elapsed < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, total]);
  const local = ms - delayMs;
  let index = 0;
  return (
    <Tag aria-label={text} className={className}>
      <span
        aria-hidden="true"
        style={spec.target === "whole" ? effectPose(spec, 0, 1, local) : undefined}
        className="inline-block">
        {words.map((word, w) => (
          <span key={`${w}-${word}`}>
            <span
              className="inline-block whitespace-nowrap"
              style={spec.target === "per-word" ? effectPose(spec, w, count, local) : undefined}>
              {perChar
                ? [...word].map((char) => {
                    const i = index++;
                    return (
                      <span className="inline-block" key={i} style={effectPose(spec, i, count, local)}>
                        {char}
                      </span>
                    );
                  })
                : word}
            </span>
            {w < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    </Tag>
  );
}

const LINE = "Here's to what's next, Anik!";
const EFFECT_MS = 2600;

/**
 * The text effect catalogue, played from its real specs (timing, stagger, easing, from/to) over the end card of the
 * project you saw. The chip names the effect.
 */
function TextFxDemo({ paused }: { paused?: boolean }): React.ReactElement {
  const [state, setState] = useState({ index: 0, ms: 900 });
  useLoop(
    TEXT_SPECS.length * EFFECT_MS,
    (p) => {
      const at = p * TEXT_SPECS.length;
      setState({ index: Math.floor(at), ms: (at % 1) * EFFECT_MS });
    },
    { paused, still: 0.3 }
  );
  const spec = TEXT_SPECS[state.index];
  const words = LINE.split(" ");
  const chars = [...LINE];
  // Every unit (letter or word) starts after its stagger; letters from the edges count inward.
  const units =
    spec.target === "per-word" ? words.map((w, i) => (i < words.length - 1 ? `${w}\u00a0` : w)) : chars;
  const exit = span(state.ms, EFFECT_MS - 260, EFFECT_MS);
  const pose = (i: number): React.CSSProperties => {
    const base = effectPose(spec, i, units.length, state.ms - 150);
    return { ...base, opacity: Number(base.opacity) * (1 - exit) };
  };
  return (
    <div className="relative size-full overflow-hidden">
      {/* biome-ignore lint/performance/noImgElement: a fixed-size still inside an animated card; next/image adds nothing here */}
      <img
        alt=""
        className="absolute inset-0 size-full object-cover opacity-25 blur-[2px]"
        src={FRAME_HOME}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20" />
      <div className="relative flex size-full flex-col items-center justify-center gap-4 px-5">
        <p
          aria-label={LINE}
          className="text-balance text-center font-heading text-[26px] text-white leading-tight tracking-[-0.01em]">
          {units.map((unit, i) => (
            <span
              aria-hidden="true"
              className="inline-block whitespace-pre"
              key={`${spec.id}-${i}`}
              style={pose(i)}>
              {unit}
            </span>
          ))}
        </p>
        <span className="rounded-full bg-white/10 px-2.5 py-1 font-medium text-[11px] text-white/80 backdrop-blur">
          {spec.displayName}
        </span>
      </div>
    </div>
  );
}

/** The timeline's audio colours (audio-tracks.tsx, dark theme). */
const AUDIO = "oklch(0.7 0.15 295)";
const AUDIO_LINE = "oklch(0.86 0.09 295)";
const DROP_BARS = Array.from(
  { length: 56 },
  (_, i) => 0.3 + 0.7 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.23))
);

/**
 * Your own music onto the timeline, the way the studio does it: the file is carried over, the audio row lights up
 * purple as a drop target, and on release a purple clip with its waveform lays itself out along the track.
 */
function MediaDemo({ paused }: { paused?: boolean }): React.ReactElement {
  const [p, setP] = useState(0.72);
  useLoop(6800, setP, { paused, still: 0.72 });
  // Carried in-out (it moves on screen), held over the row, dropped; the clip then unrolls with an ease-out.
  const carry = easeInOut(span(p, 0.08, 0.42));
  const over = p > 0.36 && p < 0.52;
  const dropped = p >= 0.52;
  const unroll = easeOut(span(p, 0.52, 0.74));
  const leave = span(p, 0.92, 1);
  return (
    <div
      className="relative flex size-full flex-col justify-end gap-1.5 px-4 pt-3 pb-4"
      style={{ opacity: 1 - leave }}>
      <div className="flex h-11 gap-1">
        {CLIPS.map((clip) => (
          <div
            className="relative flex min-w-0 overflow-hidden rounded-md bg-white/5 shadow-[0_0_0_1px_rgb(255_255_255/0.08)_inset]"
            key={clip.name}
            style={{ flex: clip.seconds }}>
            {/* biome-ignore lint/performance/noImgElement: a fixed-size still inside an animated card; next/image adds nothing here */}
            <img alt="" className="h-full w-auto shrink-0 object-cover opacity-60" src={clip.src} />
            <span className="absolute inset-x-1.5 bottom-0.5 truncate text-[10px] text-white/85">
              {clip.name}
            </span>
          </div>
        ))}
      </div>
      <div
        className="relative h-11 overflow-hidden rounded-md transition-[background-color,outline-color] duration-150 ease-out"
        style={{
          backgroundColor: over
            ? `color-mix(in oklab, ${AUDIO} 12%, transparent)`
            : "rgb(255 255 255 / 0.03)",
          outline: `2px solid ${over ? `color-mix(in oklab, ${AUDIO} 48%, transparent)` : "transparent"}`,
          outlineOffset: -2,
        }}>
        {!dropped && (
          <span className="absolute inset-0 flex items-center px-2.5 text-[11px] text-muted-foreground">
            Drop music or sound effects here
          </span>
        )}
        {dropped && (
          <div
            className="absolute inset-y-0 left-0 flex w-[88%] flex-col overflow-hidden rounded-md px-2 py-1"
            style={{
              border: `1px solid color-mix(in oklab, ${AUDIO} 40%, transparent)`,
              backgroundColor: `color-mix(in oklab, ${AUDIO} 14%, transparent)`,
              clipPath: `inset(0 ${(1 - unroll) * 100}% 0 0 round 6px)`,
            }}>
            <span className="truncate text-[10px] text-white/90">launch-theme.mp3</span>
            <span className="flex flex-1 items-center gap-[2px]">
              {DROP_BARS.map((h, i) => (
                <span
                  className="flex-1 rounded-full"
                  key={`b-${i}`}
                  style={{ height: `${h * 90}%`, backgroundColor: AUDIO_LINE, opacity: 0.85 }}
                />
              ))}
            </span>
          </div>
        )}
      </div>
      {/* The file being carried: from the top right down onto the audio row, tilted a little like a held card. */}
      {!dropped && (
        <div
          className="pointer-events-none absolute top-3 right-4 flex items-center gap-2 rounded-lg bg-[color-mix(in_oklab,var(--background),white_10%)] py-1.5 pr-2.5 pl-1.5 shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_12px_24px_-8px_rgb(0_0_0/0.8)]"
          style={{
            transform: `translate(${-carry * 62}%, ${carry * 150}%) rotate(${lerp(4, -2, carry)}deg) scale(${over ? 0.97 : 1})`,
            transition: "scale 120ms ease-out",
          }}>
          <span
            className="flex size-6 items-center justify-center rounded-md"
            style={{ backgroundColor: `color-mix(in oklab, ${AUDIO} 22%, transparent)` }}>
            <span style={{ color: AUDIO_LINE }}>
              <MusicIcon className="size-3.5" />
            </span>
          </span>
          <span className="flex flex-col">
            <span className="text-[11px] text-foreground">launch-theme.mp3</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">Music · 2:40</span>
          </span>
        </div>
      )}
    </div>
  );
}

/** The editor's preset tile device: a window with a sidebar and a few rows, small enough to read its pose. */
function PresetDevice({ deviceRef }: { deviceRef: React.Ref<HTMLDivElement> }): React.ReactElement {
  return (
    <div
      className="flex aspect-[16/10] w-[58%] overflow-hidden rounded-[4px] bg-card shadow-md/10 ring-1 ring-foreground/12 will-change-transform"
      ref={deviceRef}>
      <div className="w-[22%] border-e bg-muted/64" />
      <div className="flex flex-1 flex-col gap-[7%] p-[7%]">
        <div className="h-[9%] w-1/2 rounded-full bg-foreground/24" />
        <div className="h-[22%] rounded-[2px] bg-info/32" />
        <div className="h-[8%] w-4/5 rounded-full bg-foreground/12" />
        <div className="h-[8%] w-3/5 rounded-full bg-foreground/12" />
      </div>
    </div>
  );
}

/** One preset, playing on a loop with the same WAAPI frames the editor's tile plays on hover. */
function PresetTile({
  preset,
  delay,
  paused,
  focused,
}: {
  preset: MotionPreset;
  delay: number;
  paused?: boolean;
  focused?: boolean;
}) {
  const device = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation | null>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const element = device.current;
    if (!element || reduced) return;
    const { frames, durationMs } = motionPreviewFrames(preset, "both");
    animation.current = element.animate(frames, {
      duration: durationMs,
      iterations: Number.POSITIVE_INFINITY,
      delay,
    });
    animation.current.playbackRate = motion.speed;
    return () => animation.current?.cancel();
  }, [preset, delay, reduced]);
  useEffect(() => {
    if (paused) animation.current?.pause();
    else animation.current?.play();
  }, [paused]);
  return (
    <div className="flex w-[52px] shrink-0 flex-col items-center gap-1">
      <span
        className={cn(
          "relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-white/[0.04] [perspective:240px]",
          focused
            ? "shadow-[0_0_0_1px_rgb(255_255_255/0.16),0_8px_20px_-8px_rgb(0_0_0/0.8)]"
            : "shadow-[0_0_0_1px_rgb(255_255_255/0.07)]"
        )}>
        <PresetDevice deviceRef={device} />
      </span>
      <span className="w-full truncate text-center text-[9px] text-muted-foreground leading-3">
        {preset.name}
      </span>
    </div>
  );
}

/** Progressive blur toward both sides, like Raycast's "plus thousands more" grid: sharp centre, soft edges. */
const SIDE_BLUR = [
  { blur: 1, mask: "linear-gradient(to right, black 0%, transparent 34%, transparent 66%, black 100%)" },
  { blur: 3, mask: "linear-gradient(to right, black 0%, transparent 22%, transparent 78%, black 100%)" },
  { blur: 6, mask: "linear-gradient(to right, black 0%, transparent 11%, transparent 89%, black 100%)" },
];

/**
 * The motion presets, every one playing at once in two staggered rows. The edges blur and fade away, so the centre
 * reads as a selection out of a larger set.
 */
function MotionDemo({ paused }: { paused?: boolean }): React.ReactElement {
  const rows = [MOTION_PRESETS.slice(0, 7), MOTION_PRESETS.slice(6, 13)];
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2.5 px-2 py-2.5">
      <div
        className="relative flex w-full flex-col items-center gap-1.5 overflow-hidden"
        style={{ maskImage: "linear-gradient(to right, transparent, black 18%, black 82%, transparent)" }}>
        {rows.map((row, r) => (
          <div className="flex gap-1.5" key={`row-${r}`} style={{ transform: `translateX(${r ? 27 : 0}px)` }}>
            {row.map((preset, i) => (
              <PresetTile
                delay={(r * 7 + i) * 230}
                focused={i === 3 && r === 0}
                key={`${r}-${preset.id}`}
                paused={paused}
                preset={preset}
              />
            ))}
          </div>
        ))}
        {SIDE_BLUR.map((layer) => (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            key={layer.blur}
            style={{
              backdropFilter: `blur(${layer.blur}px)`,
              WebkitBackdropFilter: `blur(${layer.blur}px)`,
              maskImage: layer.mask,
              WebkitMaskImage: layer.mask,
            }}
          />
        ))}
      </div>
      <p className="text-center text-xs">
        <span className="text-foreground">{MOTION_PRESETS.length} ready-made moves</span>
        <span className="text-muted-foreground"> · drag one onto any clip</span>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- features --------------------------------------------------------------- */

export type Feature = {
  id: string;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  Demo: React.ComponentType<{ paused?: boolean }>;
};

export const FEATURES: Feature[] = [
  {
    id: "media",
    Icon: FileIcon,
    title: "Your media",
    description: "Drag in music, video and images. They land on the timeline next to your recordings.",
    Demo: MediaDemo,
  },
  {
    id: "motion",
    Icon: SparklesIcon,
    title: "Motion presets",
    description: "Flip, swing, orbit or fly your app in. Each move keys itself on the clip you drop it on.",
    Demo: MotionDemo,
  },
  {
    id: "text",
    Icon: CaptionsIcon,
    title: "Text effects",
    description: "Put titles over any scene, with effects timed and eased like a motion designer would.",
    Demo: TextFxDemo,
  },
  {
    id: "stage",
    Icon: BoxIcon,
    title: "3D stage",
    description: "Turn your app in 3D like a camera on set. Drag the sphere to try it.",
    Demo: StageDemo,
  },
  {
    id: "easing",
    Icon: SlidersHorizontalIcon,
    title: "Easing",
    description: "Shape every move with real curves, or drag the handles yourself.",
    Demo: EasingDemo,
  },
  {
    id: "storyboard",
    Icon: SparklesIcon,
    title: "Storyboard",
    description: "Describe the video. Claude plans the scenes and records each one.",
    Demo: StoryboardDemo,
  },
  {
    id: "record",
    Icon: MonitorIcon,
    title: "Recording",
    description: "vaunt clicks through your app in Chromium and keeps every frame at 60 fps.",
    Demo: RecordDemo,
  },
  {
    id: "timeline",
    Icon: LayersIcon,
    title: "Timeline",
    description: "Cut clips, lay music under them and set the pace frame by frame.",
    Demo: TimelineDemo,
  },
  {
    id: "export",
    Icon: DownloadIcon,
    title: "Export",
    description: "MP4 or ProRes at up to 60 fps, saved straight to Downloads.",
    Demo: ExportDemo,
  },
];
