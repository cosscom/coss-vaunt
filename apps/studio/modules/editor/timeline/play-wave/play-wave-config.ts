/**
 * The animated play button's look: a solid play triangle that opens into a pill of waveform bars while playing.
 * Tuned by hand in a lab (since removed); the chosen values live in `play-wave.config.json` beside this file, which
 * the transport reads. These defaults match it.
 */
export type PlayWaveSource = "audio" | "clips" | "synthetic";
export type PlayWaveEasing = "drawer" | "expo" | "quint" | "spring";
/** `gradient` runs the bars from the app's info blue to the audio purple; `mono` draws them in the foreground. */
export type PlayWavePalette = "gradient" | "mono";

export type PlayWaveConfig = {
  /** Which data the bars show; the transport uses audio when there is any, else the clips. */
  source: PlayWaveSource;
  seed: number;
  /** Closed: a circle this many px across. */
  size: number;
  /** Open: the pill's width in px. */
  width: number;
  /** The play triangle's height as a fraction of the circle, and how round its corners are (px). */
  triangleScale: number;
  triangleRadius: number;
  /** Nudges the triangle toward its point (px), so it reads as centred. */
  triangleOffset: number;
  bars: number;
  barWidth: number;
  /** Bars at the pill's edges shrink to dots this tall (px). */
  dotSize: number;
  /** How tall the loudest bar is, as a fraction of the pill's height. */
  amplitude: number;
  /** How narrow the tall middle is: 0 keeps every bar full height, 1 leaves only the centre tall. */
  focus: number;
  /** Seconds of media across the pill; the playhead sits in the middle. */
  window: number;
  openMs: number;
  closeMs: number;
  easing: PlayWaveEasing;
  /** For the spring easing: 0 is critically damped, higher overshoots. */
  bounce: number;
  /** Each bar's reveal waits this much per bar away from the centre (ms). */
  stagger: number;
  /** Bars grow from 0 to their height over this long once revealed (ms). */
  barMs: number;
  palette: PlayWavePalette;
};

export const DEFAULT_PLAY_WAVE_CONFIG: PlayWaveConfig = {
  source: "audio",
  seed: 1,
  size: 32,
  width: 132,
  triangleScale: 0.42,
  triangleRadius: 2,
  triangleOffset: 1.5,
  bars: 35,
  barWidth: 1.5,
  dotSize: 2,
  amplitude: 0.45,
  focus: 0.31,
  window: 2.5,
  openMs: 280,
  closeMs: 210,
  easing: "spring",
  bounce: 0.3,
  stagger: 14,
  barMs: 230,
  palette: "gradient",
};

/** Bounds that were tested to render sensibly, for anyone tuning the values again. */
export const PLAY_WAVE_BOUNDS: Record<
  Exclude<keyof PlayWaveConfig, "source" | "easing" | "palette" | "seed">,
  { min: number; max: number; step: number }
> = {
  size: { min: 24, max: 48, step: 1 },
  width: { min: 64, max: 240, step: 2 },
  triangleScale: { min: 0.25, max: 0.6, step: 0.01 },
  triangleRadius: { min: 0, max: 5, step: 0.25 },
  triangleOffset: { min: 0, max: 4, step: 0.25 },
  bars: { min: 9, max: 61, step: 2 },
  barWidth: { min: 1, max: 4, step: 0.5 },
  dotSize: { min: 1, max: 4, step: 0.5 },
  amplitude: { min: 0.2, max: 0.9, step: 0.01 },
  focus: { min: 0, max: 1, step: 0.01 },
  window: { min: 1, max: 20, step: 0.5 },
  openMs: { min: 150, max: 1200, step: 10 },
  closeMs: { min: 100, max: 900, step: 10 },
  bounce: { min: 0, max: 0.6, step: 0.01 },
  stagger: { min: 0, max: 40, step: 1 },
  barMs: { min: 60, max: 600, step: 10 },
};

const BEZIERS: Record<Exclude<PlayWaveEasing, "spring">, string> = {
  drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
  expo: "cubic-bezier(0.16, 1, 0.3, 1)",
  quint: "cubic-bezier(0.23, 1, 0.32, 1)",
};

/** A damped spring as a CSS `linear()` curve that settles within the transition's duration. */
export function springEasing(bounce: number, samples = 48): string {
  const damping = Math.min(1, Math.max(0.05, 1 - bounce));
  // Decayed to ~0.1% by t = 1 whatever the damping, so the duration knob stays the duration.
  const omega = 6.9 / damping;
  const points: string[] = [];
  for (let index = 0; index <= samples; index++) {
    const t = index / samples;
    let x: number;
    if (damping >= 1) x = 1 - Math.exp(-omega * t) * (1 + omega * t);
    else {
      const damped = omega * Math.sqrt(1 - damping * damping);
      x =
        1 -
        Math.exp(-damping * omega * t) *
          (Math.cos(damped * t) + ((damping * omega) / damped) * Math.sin(damped * t));
    }
    points.push((index === samples ? 1 : x).toFixed(4));
  }
  return `linear(${points.join(", ")})`;
}

export function playWaveEasing(config: Pick<PlayWaveConfig, "easing" | "bounce">): string {
  return config.easing === "spring" ? springEasing(config.bounce) : BEZIERS[config.easing];
}

/** How tall bar `index` may be, 0–1: full in the middle, falling off toward the edges by `focus`. */
export function barEnvelope(index: number, count: number, focus: number): number {
  const half = (count - 1) / 2;
  const distance = half === 0 ? 0 : Math.abs(index - half) / half;
  const width = 1 - focus * 0.9;
  return Math.exp(-((distance / Math.max(0.08, width)) ** 2) * 1.6);
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
