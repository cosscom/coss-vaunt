"use client";

import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { CheckIcon, CircleAlertIcon, ExternalLinkIcon } from "@coss/ui/icons";
// The onboarding's two studio slides: the bento (directing, with Claude) and the tile walk (your media).
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { ClaudeMark } from "./brand-marks";
import { FEATURES, type Feature, FeatureCard, motion, useReducedMotion } from "./feature-cards";
import { Slide } from "./onboarding";
import { BorderBeam } from "@/modules/border-beam/border-beam";
import { CARD_BEAM } from "@/modules/border-beam/border-beam-engine";

/** Pauses a card's demo while it's off screen, so a wall of them stays cheap. */
function useInView<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView];
}

/* ------------------------------------------------------------- 1. Tile walk ------------------------------------------------------------ */

const TILE_W = 380;
const TILE_H = 300;
const GAP = 20;
const COLUMNS = 4;
const pick = (ids: string[]): Feature[] => ids.map((id) => FEATURES.find((f) => f.id === id) as Feature);
/** The walk is about what you bring and how you move it: your media, motion presets, titles, and where it all lands. */
const WALK = pick(["media", "motion", "text", "stage", "easing", "export"]);
const PERIOD_ROWS = WALK.length;

function WalkTile({ index, column }: { index: number; column: number }): React.ReactElement {
  const [ref, inView] = useInView<HTMLDivElement>();
  // Neighbouring columns start two features apart, so no row repeats a card side by side.
  const feature = WALK[(index + column * 2) % WALK.length];
  return (
    <div ref={ref} style={{ height: TILE_H }}>
      <FeatureCard className="size-full" feature={feature} paused={!inView} />
    </div>
  );
}

/**
 * A wall of live cards on a tilted plane that the camera walks across, slowly and forever. Hover to stop and look;
 * everything stays interactive.
 */
/** How long the drift takes to settle to a stop on hover, or get back up to speed after (time constant). */
const SETTLE_S = 0.24;
const PERIOD_PX = PERIOD_ROWS * (TILE_H + GAP);
const PX_PER_S = PERIOD_PX / (PERIOD_ROWS * 9);

/**
 * Depth of field: layers that blur what's behind them, each stronger and reaching less far from the far (top)
 * edge, so focus falls off progressively instead of in one band. The near edge gets a touch too.
 */
const DOF_LAYERS = [
  { blur: 1, mask: "linear-gradient(to bottom, black 0%, black 8%, transparent 46%)" },
  { blur: 2.5, mask: "linear-gradient(to bottom, black 0%, black 6%, transparent 30%)" },
  { blur: 5, mask: "linear-gradient(to bottom, black 0%, transparent 16%)" },
  { blur: 1.2, mask: "linear-gradient(to top, black 0%, transparent 18%)" },
];

export function TileWalk(): React.ReactElement {
  const rows = PERIOD_ROWS * 2;
  const track = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  const reduced = useReducedMotion();
  // The drift: a speed that eases toward 0 while hovered and back to 1 after, so the wall coasts to a stop
  // and picks back up instead of freezing.
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = 0;
    let offset = 0;
    let velocity = 1;
    const tick = (now: number) => {
      const dt = last ? Math.min(0.064, (now - last) / 1000) : 0;
      last = now;
      const target = hovering.current || document.hidden ? 0 : 1;
      velocity += (target - velocity) * (1 - Math.exp(-dt / SETTLE_S));
      offset = (offset + velocity * PX_PER_S * motion.speed * dt) % PERIOD_PX;
      if (track.current) track.current.style.transform = `translate3d(0, ${-offset}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);
  const canHover = typeof window !== "undefined" && matchMedia("(hover: hover) and (pointer: fine)").matches;
  return (
    <Slide
      body="Drop in your own video, images and music, put titles over any scene with real text effects, and cut it all together."
      tag="Make it yours"
      title="Bring your own media"
      visual={
        <div
          className="absolute inset-y-[-40px] right-0 left-0 overflow-hidden [perspective:2200px]"
          onPointerEnter={() => {
            if (canHover) hovering.current = true;
          }}
          onPointerLeave={() => {
            hovering.current = false;
          }}
          style={{
            maskImage:
              // A wide, eased fade on the left (where the copy sits) so the wall recedes into the page.
              "linear-gradient(to right, transparent 0%, rgb(0 0 0 / 0.06) calc(var(--walk-fade, 20%) * 0.25), rgb(0 0 0 / 0.3) calc(var(--walk-fade, 20%) * 0.55), rgb(0 0 0 / 0.75) calc(var(--walk-fade, 20%) * 0.82), black var(--walk-fade, 20%), black 94%, transparent), linear-gradient(to bottom, transparent, black 16%, black 84%, transparent)",
            maskComposite: "intersect",
            WebkitMaskComposite: "source-in",
          }}>
          <div
            className="absolute top-1/2 left-1/2 [transform-style:preserve-3d]"
            style={{
              width: COLUMNS * TILE_W + (COLUMNS - 1) * GAP,
              transform:
                "translate(-46%, -38%) rotateX(var(--walk-tilt, 30deg)) rotateZ(var(--walk-turn, 0deg)) scale(0.92)",
            }}>
            <div
              className="grid gap-5 will-change-transform"
              ref={track}
              style={
                {
                  gridTemplateColumns: `repeat(${COLUMNS}, ${TILE_W}px)`,
                } as React.CSSProperties
              }>
              {Array.from({ length: rows }, (_, row) =>
                Array.from({ length: COLUMNS }, (_, column) => (
                  // Odd columns sit half a tile lower, so the wall reads as a weave, not a spreadsheet.
                  <div
                    key={`${row}-${column}`}
                    style={{ transform: column % 2 ? `translateY(${TILE_H / 2}px)` : undefined }}>
                    <WalkTile column={column} index={row} />
                  </div>
                ))
              )}
            </div>
          </div>
          {DOF_LAYERS.map((layer) => (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              key={layer.mask + layer.blur}
              style={{
                backdropFilter: `blur(calc(${layer.blur}px * var(--dof, 0.75)))`,
                WebkitBackdropFilter: `blur(calc(${layer.blur}px * var(--dof, 0.75)))`,
                maskImage: layer.mask,
                WebkitMaskImage: layer.mask,
              }}
            />
          ))}
        </div>
      }
      visualClassName="overflow-visible"
    />
  );
}

/* --------------------------------------------------------------- 2. Bento -------------------------------------------------------------- */

type KeySource = "saved" | "env" | null;
type KeyState =
  | { phase: "loading" }
  | { phase: "connected"; source: "saved" | "env" }
  | { phase: "missing" }
  | { phase: "editing" };

/**
 * Connect Claude: the studio's real AI settings. A key that's already saved (or set in the environment) shows as
 * connected; a new one goes to the same endpoint the settings dialog uses, which keeps it in ~/.config/coss-vaunt.
 */
function ClaudeKey(): React.ReactElement {
  const [state, setState] = useState<KeyState>({ phase: "loading" });
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetch("/api/settings/ai")
      .then((r) => r.json())
      .then((view: { keys: Record<string, KeySource> }) => {
        const source = view.keys.anthropic;
        setState(source ? { phase: "connected", source } : { phase: "missing" });
      })
      .catch(() => setState({ phase: "missing" }));
  }, []);

  const save = async () => {
    const trimmed = key.trim();
    if (!trimmed.startsWith("sk-ant-")) {
      setError("Anthropic keys start with sk-ant-. Copy the whole key from the Claude Console.");
      return;
    }
    setSaving(true);
    setError(null);
    const response = await fetch("/api/settings/ai", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "anthropic", apiKey: trimmed }),
    }).catch(() => null);
    setSaving(false);
    if (!response?.ok) {
      setError("Couldn't save the key. Check the studio is still running, then try again.");
      return;
    }
    setKey("");
    setState({ phase: "connected", source: "saved" });
  };

  const connected = state.phase === "connected";
  // Lit like a storyboard scene card: the beam while the key saves, the green ring once Claude is connected.
  return (
    <BorderBeam
      className="max-w-[440px]"
      options={CARD_BEAM}
      state={saving ? "active" : connected ? "success" : "idle"}>
      <div className="flex flex-col gap-3 rounded-2xl bg-white/[0.035] p-4 shadow-[0_0_0_1px_rgb(255_255_255/0.07)] backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-black">
            <ClaudeMark className="size-[18px]" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-1.5 font-medium text-foreground text-sm">
              {connected ? "Claude is connected" : "Connect Claude"}
              {connected && <CheckIcon className="size-3.5 text-success" />}
            </span>
            <span className="text-muted-foreground text-xs">
              {state.phase === "loading"
                ? "Checking for a saved key…"
                : connected
                  ? state.source === "env"
                    ? "Using ANTHROPIC_API_KEY from your environment."
                    : "Your Anthropic key is saved on this machine."
                  : "Claude plans scenes and drives your app. Kept on this machine, never in a project."}
            </span>
          </div>
          {connected && state.source === "saved" && (
            <Button onClick={() => setState({ phase: "editing" })} size="sm" variant="ghost">
              Replace
            </Button>
          )}
        </div>
        {(state.phase === "missing" || state.phase === "editing") && (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}>
            <label className="sr-only" htmlFor="onb-claude-key">
              Anthropic API key
            </label>
            <div className="flex gap-2">
              <Input
                aria-invalid={error ? true : undefined}
                autoComplete="off"
                className="flex-1 font-mono text-base sm:text-sm"
                id="onb-claude-key"
                onChange={(e) => {
                  setKey(e.target.value);
                  setError(null);
                }}
                placeholder="sk-ant-…"
                spellCheck={false}
                type="password"
                value={key}
              />
              <Button disabled={!key.trim()} loading={saving} type="submit" variant="secondary">
                Save key
              </Button>
            </div>
            {error ? (
              <p className="flex items-center gap-1.5 text-destructive-foreground text-xs" role="alert">
                <CircleAlertIcon className="size-3.5 shrink-0" />
                {error}
              </p>
            ) : (
              <a
                className="flex w-fit items-center gap-1 text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
                href="https://console.anthropic.com/settings/keys"
                rel="noreferrer"
                target="_blank">
                Get a key in the Claude Console
                <ExternalLinkIcon className="size-3" />
              </a>
            )}
          </form>
        )}
      </div>
    </BorderBeam>
  );
}

const BENTO: { id: string; className: string }[] = [
  { id: "storyboard", className: "" },
  { id: "stage", className: "col-span-2" },
  { id: "record", className: "" },
  { id: "easing", className: "" },
  { id: "timeline", className: "" },
];

/** Raycast's grid: every feature at once, nothing moving but the demos inside the cards. */
export function Bento(): React.ReactElement {
  return (
    <Slide
      aside={<ClaudeKey />}
      body="Tell Claude what the video should show. It plans the scenes and clicks through your app to record them, then you direct the rest."
      tag="The studio"
      title="Direct your app like a film"
      visual={
        <div className="grid h-full grid-cols-3 grid-rows-2 gap-3 py-2 pr-4">
          {BENTO.map(({ id, className }, i) => {
            const feature = FEATURES.find((f) => f.id === id);
            if (!feature) return null;
            return (
              <FeatureCard
                className={cn("onb-in", className)}
                feature={feature}
                key={id}
                style={{ "--d": `${120 + i * 60}ms` } as React.CSSProperties}
              />
            );
          })}
        </div>
      }
    />
  );
}
