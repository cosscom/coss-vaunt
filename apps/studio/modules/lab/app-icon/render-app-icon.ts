/**
 * The app-icon lab's renderer: one bold rounded V on a macOS squircle, its left stroke solid and its right stroke
 * built from particles that dissolve outward like the startup particle reveal (same seeded PRNG, same soft-core
 * dot). `renderAppIcon` is pure: the same config (seed included) always draws the same pixels.
 *
 * Fixed geometry (Apple's Big Sur+ icon grid): a 1024 × 1024 canvas, an 824 × 824 tile centred with 100 px of
 * margin for the drop shadow, and a continuous-curvature corner (a superellipse, n = 5).
 */

export const ICON_SIZE = 1024;
export const TILE_SIZE = 824;
const TILE_INSET = (ICON_SIZE - TILE_SIZE) / 2;
const SQUIRCLE_N = 5;

export type IconMode = "dark-mono" | "gradient-tile" | "glass-glyph" | "studio";

export type AppIconConfig = {
  mode: IconMode;
  seed: number;
  // Tile
  tileStyle: "linear" | "radial";
  tileFrom: string;
  tileTo: string;
  tileAngle: number;
  monotone: boolean;
  monoTint: string;
  // Glyph
  glyphFill: "solid" | "gradient";
  glyphFrom: string;
  glyphTo: string;
  glyphOpacity: number;
  glyphGlass: number;
  glyphShadow: number;
  strokeWeight: number;
  roundness: number;
  glyphWidth: number;
  glyphHeight: number;
  opticalOffset: number;
  // Particles
  particleCount: number;
  particleSize: number;
  sizeVariance: number;
  solidSplit: number;
  splitFeather: number;
  density: number;
  dissolve: number;
  dissolveAngle: number;
  dissolveSpread: number;
  jitter: number;
  particleGlow: number;
  // Surface
  grainAmount: number;
  grainSize: number;
  shineX: number;
  shineY: number;
  shineIntensity: number;
  shineSpread: number;
  rimLight: number;
  rimWidth: number;
  innerShadow: number;
  dropShadow: number;
  shadowBlur: number;
  shadowY: number;
};

const BASE: AppIconConfig = {
  mode: "dark-mono",
  seed: 7,
  tileStyle: "linear",
  tileFrom: "#2b2b2f",
  tileTo: "#121214",
  tileAngle: 180,
  monotone: false,
  monoTint: "#8b5cf6",
  glyphFill: "solid",
  glyphFrom: "#ffffff",
  glyphTo: "#e4e4e7",
  glyphOpacity: 1,
  glyphGlass: 0,
  glyphShadow: 0.35,
  strokeWeight: 132,
  roundness: 1,
  glyphWidth: 470,
  glyphHeight: 430,
  opticalOffset: 14,
  particleCount: 5200,
  particleSize: 5,
  sizeVariance: 0.6,
  solidSplit: 0.22,
  splitFeather: 0.12,
  density: 0.9,
  dissolve: 120,
  dissolveAngle: 62,
  dissolveSpread: 0.45,
  jitter: 8,
  particleGlow: 0.35,
  grainAmount: 0.45,
  grainSize: 1.2,
  shineX: 0.16,
  shineY: 0.04,
  shineIntensity: 0.45,
  shineSpread: 0.42,
  rimLight: 0.35,
  rimWidth: 3,
  innerShadow: 0.35,
  dropShadow: 0.5,
  shadowBlur: 36,
  shadowY: 14,
};

/** The modes are starting points: picking one resets every knob to its preset (and keeps the seed). */
export const MODE_PRESETS: Record<IconMode, { label: string; hint: string; config: AppIconConfig }> = {
  "dark-mono": { label: "Dark mono", hint: "Notion / Linear", config: BASE },
  "gradient-tile": {
    label: "Gradient tile",
    hint: "Obsidian",
    config: {
      ...BASE,
      mode: "gradient-tile",
      tileFrom: "#8b5cf6",
      tileTo: "#5b21d6",
      tileAngle: 180,
      glyphFrom: "#ffffff",
      glyphTo: "#ede9fe",
      glyphShadow: 0.55,
      glyphGlass: 0.25,
      grainAmount: 0.3,
      particleGlow: 0.45,
      shineIntensity: 0.35,
      rimLight: 0.45,
      innerShadow: 0.3,
    },
  },
  "glass-glyph": {
    label: "Glass glyph",
    hint: "Translucent V, inner glow",
    config: {
      ...BASE,
      mode: "glass-glyph",
      tileStyle: "radial",
      tileFrom: "#4c1d95",
      tileTo: "#170a3a",
      tileAngle: 90,
      glyphFill: "gradient",
      glyphFrom: "#ffffff",
      glyphTo: "#c4b5fd",
      glyphOpacity: 0.88,
      glyphGlass: 0.9,
      glyphShadow: 0.6,
      particleGlow: 0.6,
      grainAmount: 0.35,
      shineIntensity: 0.3,
      rimLight: 0.5,
    },
  },
  studio: {
    label: "Studio",
    hint: "Play button's blue → purple",
    config: {
      ...BASE,
      mode: "studio",
      tileFrom: "#3b82f6",
      tileTo: "#8b5cf6",
      tileAngle: 135,
      glyphShadow: 0.45,
      glyphGlass: 0.15,
      grainAmount: 0.28,
      particleGlow: 0.4,
      shineIntensity: 0.4,
      rimLight: 0.4,
      innerShadow: 0.25,
    },
  },
};

export const DEFAULT_CONFIG: AppIconConfig = MODE_PRESETS["dark-mono"].config;

export type NumberKnob = {
  key: { [K in keyof AppIconConfig]: AppIconConfig[K] extends number ? K : never }[keyof AppIconConfig];
  label: string;
  min: number;
  max: number;
  step: number;
};

/** Every numeric knob with the range it's been tested across (see the lab's "Test ranges" button). */
export const KNOB_GROUPS: { title: string; knobs: NumberKnob[] }[] = [
  {
    title: "Tile",
    knobs: [{ key: "tileAngle", label: "Gradient angle", min: 0, max: 360, step: 1 }],
  },
  {
    title: "Glyph",
    knobs: [
      { key: "strokeWeight", label: "Stroke weight", min: 60, max: 200, step: 1 },
      { key: "roundness", label: "Roundness", min: 0, max: 1, step: 0.01 },
      { key: "glyphWidth", label: "Width", min: 320, max: 600, step: 1 },
      { key: "glyphHeight", label: "Height", min: 300, max: 520, step: 1 },
      { key: "opticalOffset", label: "Optical offset", min: -40, max: 60, step: 1 },
      { key: "glyphOpacity", label: "Opacity", min: 0.2, max: 1, step: 0.01 },
      { key: "glyphGlass", label: "Glass", min: 0, max: 1, step: 0.01 },
      { key: "glyphShadow", label: "Glyph shadow", min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    title: "Particles",
    knobs: [
      { key: "particleCount", label: "Count", min: 0, max: 14000, step: 100 },
      { key: "particleSize", label: "Size", min: 1, max: 16, step: 0.1 },
      { key: "sizeVariance", label: "Size variance", min: 0, max: 1, step: 0.01 },
      { key: "solidSplit", label: "Solid until", min: 0, max: 0.9, step: 0.01 },
      { key: "splitFeather", label: "Split feather", min: 0, max: 0.4, step: 0.01 },
      { key: "density", label: "Falloff", min: 0, max: 5, step: 0.05 },
      { key: "dissolve", label: "Dissolve extent", min: 0, max: 420, step: 1 },
      { key: "dissolveAngle", label: "Dissolve direction°", min: -180, max: 180, step: 1 },
      { key: "dissolveSpread", label: "Direction spread", min: 0, max: 1, step: 0.01 },
      { key: "jitter", label: "Jitter", min: 0, max: 48, step: 0.5 },
      { key: "particleGlow", label: "Glow", min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    title: "Grain",
    knobs: [
      { key: "grainAmount", label: "Amount", min: 0, max: 1, step: 0.01 },
      { key: "grainSize", label: "Size", min: 0.5, max: 4, step: 0.1 },
    ],
  },
  {
    title: "Light",
    knobs: [
      { key: "shineIntensity", label: "Corner shine", min: 0, max: 1, step: 0.01 },
      { key: "shineX", label: "Shine x", min: 0, max: 1, step: 0.01 },
      { key: "shineY", label: "Shine y", min: 0, max: 1, step: 0.01 },
      { key: "shineSpread", label: "Shine spread", min: 0.05, max: 1, step: 0.01 },
      { key: "rimLight", label: "Rim light", min: 0, max: 1, step: 0.01 },
      { key: "rimWidth", label: "Rim width", min: 1, max: 12, step: 0.5 },
      { key: "innerShadow", label: "Inner shadow", min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    title: "Drop shadow",
    knobs: [
      { key: "dropShadow", label: "Opacity", min: 0, max: 1, step: 0.01 },
      { key: "shadowBlur", label: "Blur", min: 0, max: 90, step: 1 },
      { key: "shadowY", label: "Offset y", min: 0, max: 50, step: 1 },
    ],
  },
];

// ——— maths ———

/** The particle reveal's PRNG (mulberry32), so a seed means the same thing here as there. */
export function seededRandom(start: number): () => number {
  let seed = start | 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Vec = { x: number; y: number };
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
const len = (a: Vec) => Math.hypot(a.x, a.y);
const norm = (a: Vec): Vec => scale(a, 1 / (len(a) || 1));
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function intersect(p: Vec, d: Vec, q: Vec, e: Vec): Vec {
  const cross = d.x * e.y - d.y * e.x;
  if (Math.abs(cross) < 1e-9) return p;
  const t = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / cross;
  return add(p, scale(d, t));
}

// ——— colour ———

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.padEnd(6, "0");
  const n = Number.parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl([r, g, b]: Rgb): Rgb {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === rn
      ? ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
      : max === gn
        ? ((bn - rn) / d + 2) / 6
        : ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb([h, s, l]: Rgb): Rgb {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue = (p: number, q: number, t: number) => {
    const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
}

/** Monotone: keep each colour's lightness, take the tint's hue and (gentled) saturation. */
function monoOf(color: string, tint: string): string {
  const [, , l] = rgbToHsl(parseHex(color));
  const [h, s] = rgbToHsl(parseHex(tint));
  const [r, g, b] = hslToRgb([h, s * (1 - Math.abs(l - 0.5) * 0.9), l]);
  return rgba([r, g, b], 1);
}

const rgba = ([r, g, b]: Rgb, a: number) =>
  `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;

// ——— shapes ———

function squirclePath(): Path2D {
  const path = new Path2D();
  const half = TILE_SIZE / 2;
  const c = ICON_SIZE / 2;
  const steps = 720;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const x = c + half * Math.sign(cos) * Math.abs(cos) ** (2 / SQUIRCLE_N);
    const y = c + half * Math.sign(sin) * Math.abs(sin) ** (2 / SQUIRCLE_N);
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
  return path;
}

/** A closed polygon with each corner rounded by up to `radii[i]`, clamped so neighbouring arcs never overlap. */
function roundedPolygon(points: Vec[], radii: number[]): Path2D {
  const path = new Path2D();
  const n = points.length;
  const start = scale(add(points[0], points[1]), 0.5);
  path.moveTo(start.x, start.y);
  for (let k = 1; k <= n; k++) {
    const i = k % n;
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const a = norm(sub(p0, p1));
    const b = norm(sub(p2, p1));
    const theta = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
    const tanHalf = Math.tan(theta / 2);
    const maxTangent = Math.min(len(sub(p0, p1)), len(sub(p2, p1))) / 2;
    const r = Math.max(0, Math.min(radii[i], maxTangent * tanHalf));
    path.arcTo(p1.x, p1.y, p2.x, p2.y, r);
  }
  path.closePath();
  return path;
}

type VGeometry = {
  path: Path2D;
  /** The right stroke's centreline, vertex end to top end. */
  axisStart: Vec;
  axisEnd: Vec;
  /** Unit perpendicular to the right stroke. */
  across: Vec;
  top: number;
  bottom: number;
  centreX: number;
};

function vGeometry(cfg: AppIconConfig): VGeometry {
  const cx = ICON_SIZE / 2;
  const cy = ICON_SIZE / 2 + cfg.opticalOffset;
  const w = cfg.glyphWidth;
  const h = cfg.glyphHeight;
  const sw = cfg.strokeWeight;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  const tlo = { x: cx - w / 2, y: y0 };
  const tro = { x: cx + w / 2, y: y0 };
  const bo = { x: cx, y: y1 };
  const dl = sub(bo, tlo);
  const dr = sub(bo, tro);
  // Inward normals (into the V's opening).
  const nl = norm({ x: dl.y, y: -dl.x });
  const nr = norm({ x: -dr.y, y: dr.x });
  const innerL = add(tlo, scale(nl, sw));
  const innerR = add(tro, scale(nr, sw));
  const top = { x: 0, y: y0 };
  const tli = intersect(innerL, dl, top, { x: 1, y: 0 });
  const tri = intersect(innerR, dr, top, { x: 1, y: 0 });
  const notch = intersect(innerL, dl, innerR, dr);
  const capW = Math.abs(tli.x - tlo.x);
  const r = cfg.roundness;
  let path: Path2D;
  let notchY = notch.y;
  if (notch.y <= y0 + 4 || tli.x >= cx) {
    // Too heavy for an opening: a solid triangle.
    path = roundedPolygon([tlo, tro, bo], [r * sw * 0.5, r * sw * 0.5, r * sw * 0.5]);
    notchY = y0;
  } else {
    path = roundedPolygon(
      [tlo, tli, notch, tri, tro, bo],
      [r * capW * 0.5, r * capW * 0.5, r * sw * 0.12, r * capW * 0.5, r * capW * 0.5, r * sw * 0.5]
    );
  }
  const axisStart = { x: cx, y: (y1 + notchY) / 2 };
  const axisEnd = { x: (tro.x + tri.x) / 2, y: y0 };
  const dir = norm(sub(axisEnd, axisStart));
  return { path, axisStart, axisEnd, across: { x: -dir.y, y: dir.x }, top: y0, bottom: y1, centreX: cx };
}

// ——— layers ———

function layer(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas context");
  return { canvas, ctx };
}

let spriteCache: HTMLCanvasElement | null = null;
/** The reveal's particle: a soft core, smoothstep(1, 0, r) squared. */
function particleSprite(): HTMLCanvasElement {
  if (spriteCache) return spriteCache;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas context");
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const s = clamp01(1 - r);
      const core = s * s * (3 - 2 * s);
      // A firmer disc than the reveal's so particles still read once the icon is small.
      const a = clamp01(core * 1.6);
      const at = (y * size + x) * 4;
      image.data[at] = 255;
      image.data[at + 1] = 255;
      image.data[at + 2] = 255;
      image.data[at + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  spriteCache = canvas;
  return canvas;
}

function tileFill(
  ctx: CanvasRenderingContext2D,
  cfg: AppIconConfig,
  from: string,
  to: string
): CanvasGradient {
  const c = ICON_SIZE / 2;
  const a = ((cfg.tileAngle - 90) * Math.PI) / 180;
  const dx = Math.cos(a) * (TILE_SIZE / 2);
  const dy = Math.sin(a) * (TILE_SIZE / 2);
  if (cfg.tileStyle === "radial") {
    // The light sits up the angle's direction (0° = top) and falls off across the tile.
    const g = ctx.createRadialGradient(
      c - dx * 0.8,
      c - dy * 0.8,
      0,
      c - dx * 0.8,
      c - dy * 0.8,
      TILE_SIZE * 1.1
    );
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    return g;
  }
  const g = ctx.createLinearGradient(c - dx, c - dy, c + dx, c + dy);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  return g;
}

/**
 * Draws the icon for `cfg` onto a 1024 × 1024 `canvas`. Pure: everything random comes from `cfg.seed`.
 */
export function renderAppIcon(canvas: HTMLCanvasElement, cfg: AppIconConfig): void {
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rnd = seededRandom(cfg.seed * 9973 + 0x2f6e2b1);
  const tone = (color: string) => (cfg.monotone ? monoOf(color, cfg.monoTint) : color);
  const tileFrom = tone(cfg.tileFrom);
  const tileTo = tone(cfg.tileTo);
  const glyphFrom = tone(cfg.glyphFrom);
  const glyphTo = tone(cfg.glyphFill === "gradient" ? cfg.glyphTo : cfg.glyphFrom);
  const tile = squirclePath();
  const c = ICON_SIZE / 2;

  ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);

  // 1. Drop shadow, cast by the tile (the tile then covers its own silhouette).
  if (cfg.dropShadow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(0, 0, 0, ${cfg.dropShadow * 0.6})`;
    ctx.shadowBlur = cfg.shadowBlur;
    ctx.shadowOffsetY = cfg.shadowY;
    ctx.fillStyle = "#000";
    ctx.fill(tile);
    ctx.restore();
  }

  // 2. The tile.
  ctx.save();
  ctx.clip(tile);
  ctx.fillStyle = tileFill(ctx, cfg, tileFrom, tileTo);
  ctx.fillRect(0, 0, ICON_SIZE, ICON_SIZE);

  // 3. Inner shadow: a dark edge rising from the bottom, cast by everything outside the tile.
  if (cfg.innerShadow > 0) {
    const ring = new Path2D();
    ring.rect(-ICON_SIZE, -ICON_SIZE, ICON_SIZE * 3, ICON_SIZE * 3);
    ring.addPath(tile);
    ctx.save();
    ctx.shadowColor = `rgba(0, 0, 0, ${cfg.innerShadow * 0.75})`;
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = -14;
    ctx.fillStyle = "#000";
    ctx.fill(ring, "evenodd");
    ctx.restore();
  }

  // 4. The glyph, on its own layer: solid V, the right stroke cut away past the split, then particles.
  const v = vGeometry(cfg);
  const glyph = layer();
  const g = glyph.ctx;
  g.fillStyle = "#fff";
  g.fill(v.path);
  const axis = sub(v.axisEnd, v.axisStart);
  const axisLen = len(axis);
  const dir = norm(axis);
  {
    const s0 = v.axisStart;
    const at = (t: number) => add(s0, scale(axis, t));
    const from = at(cfg.solidSplit - cfg.splitFeather / 2);
    const to = at(cfg.solidSplit + cfg.splitFeather / 2 + 0.001);
    const cut = g.createLinearGradient(from.x, from.y, to.x, to.y);
    cut.addColorStop(0, "rgba(0, 0, 0, 0)");
    cut.addColorStop(1, "rgba(0, 0, 0, 1)");
    g.save();
    g.beginPath();
    g.rect(v.centreX, 0, ICON_SIZE, ICON_SIZE);
    g.clip();
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = cut;
    g.fillRect(0, 0, ICON_SIZE, ICON_SIZE);
    g.restore();
  }

  // Particles fill the right stroke from the split to its tip: density falls off toward the tip as (1 - q)^falloff
  // (sampled exactly, so "count" is the number drawn) and drift grows with q, out along the dissolve direction.
  const particles = layer();
  const p = particles.ctx;
  const sprite = particleSprite();
  const hit = layer().ctx;
  const driftA = (-cfg.dissolveAngle * Math.PI) / 180;
  const startT = Math.max(0, cfg.solidSplit - cfg.splitFeather / 2 - 0.04);
  const span = Math.max(0.001, 1 - startT);
  let drawn = 0;
  let guard = 0;
  while (drawn < cfg.particleCount && guard < cfg.particleCount * 4) {
    guard++;
    const u = rnd();
    const q = 1 - (1 - u) ** (1 / (cfg.density + 1));
    const t = startT + q * span;
    const s = (rnd() - 0.5) * cfg.strokeWeight * 1.04;
    const base = add(add(v.axisStart, scale(axis, t)), scale(v.across, s));
    const r1 = rnd();
    const r2 = rnd();
    const r3 = rnd();
    const r4 = rnd();
    const r5 = rnd();
    if (!hit.isPointInPath(v.path, base.x, base.y) && t < 0.98) continue;
    drawn++;
    const reach = q ** 1.5;
    const a = driftA + (r1 - 0.5) * Math.PI * cfg.dissolveSpread;
    const d = cfg.dissolve * reach * (0.25 + 0.75 * r2);
    const jx = (r3 - 0.5) * 2 * cfg.jitter * (0.35 + q);
    const jy = (r4 - 0.5) * 2 * cfg.jitter * (0.35 + q);
    const x = base.x + Math.cos(a) * d + jx;
    const y = base.y + Math.sin(a) * d + jy;
    const size = Math.max(0.6, cfg.particleSize * (1 + cfg.sizeVariance * (r5 * 2 - 1)) * (1 - 0.35 * q));
    p.globalAlpha = clamp01((1 - 0.75 * q ** 1.2) * (0.55 + 0.45 * r2));
    p.drawImage(sprite, x - size, y - size, size * 2, size * 2);
  }
  p.globalAlpha = 1;
  g.drawImage(particles.canvas, 0, 0);

  // Colour the whole glyph (solid and particles) with its fill, top of the dissolve to the vertex.
  const glyphTop = v.top - cfg.dissolve * 0.6;
  const fill = g.createLinearGradient(0, glyphTop, 0, v.bottom);
  fill.addColorStop(0, glyphFrom);
  fill.addColorStop(1, glyphTo);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = fill;
  g.fillRect(0, 0, ICON_SIZE, ICON_SIZE);

  // Glass: an inner glow high in the V and a bright edge, both kept to the glyph.
  if (cfg.glyphGlass > 0) {
    g.globalCompositeOperation = "source-atop";
    const glow = g.createRadialGradient(c - 40, v.top + 60, 0, c - 40, v.top + 60, cfg.glyphHeight);
    glow.addColorStop(0, `rgba(255, 255, 255, ${0.55 * cfg.glyphGlass})`);
    glow.addColorStop(0.6, "rgba(255, 255, 255, 0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, ICON_SIZE, ICON_SIZE);
    const low = g.createLinearGradient(0, v.top, 0, v.bottom);
    low.addColorStop(0.55, "rgba(0, 0, 0, 0)");
    low.addColorStop(1, `rgba(40, 0, 90, ${0.22 * cfg.glyphGlass})`);
    g.fillStyle = low;
    g.fillRect(0, 0, ICON_SIZE, ICON_SIZE);
    g.lineWidth = 3 + 5 * cfg.glyphGlass;
    g.strokeStyle = `rgba(255, 255, 255, ${0.7 * cfg.glyphGlass})`;
    g.stroke(v.path);
  }
  g.globalCompositeOperation = "source-over";

  // Soft haze where the stroke dissolves: a blurred copy of the particles, lightened in.
  if (cfg.particleGlow > 0 && cfg.particleCount > 0) {
    const haze = layer();
    haze.ctx.filter = `blur(${10 + 14 * cfg.particleGlow}px)`;
    haze.ctx.drawImage(glyph.canvas, 0, 0);
    haze.ctx.filter = "none";
    // Keep the haze to the particle side so the solid stroke stays crisp.
    haze.ctx.globalCompositeOperation = "destination-in";
    const mask = haze.ctx.createLinearGradient(
      v.axisStart.x + dir.x * axisLen * (cfg.solidSplit - 0.1),
      v.axisStart.y + dir.y * axisLen * (cfg.solidSplit - 0.1),
      v.axisStart.x + dir.x * axisLen * (cfg.solidSplit + 0.15),
      v.axisStart.y + dir.y * axisLen * (cfg.solidSplit + 0.15)
    );
    mask.addColorStop(0, "rgba(0, 0, 0, 0)");
    mask.addColorStop(1, "rgba(0, 0, 0, 1)");
    haze.ctx.fillStyle = mask;
    haze.ctx.fillRect(0, 0, ICON_SIZE, ICON_SIZE);
    g.globalAlpha = 0.9 * cfg.particleGlow;
    g.globalCompositeOperation = "lighter";
    g.drawImage(haze.canvas, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  ctx.save();
  if (cfg.glyphShadow > 0) {
    ctx.shadowColor = `rgba(0, 0, 0, ${cfg.glyphShadow * 0.55})`;
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 16;
  }
  ctx.globalAlpha = cfg.glyphOpacity;
  ctx.drawImage(glyph.canvas, 0, 0);
  ctx.restore();

  // 5. Corner shine: a broad sheen plus a specular catch on the rim, both centred on the shine point.
  const sx = TILE_INSET + cfg.shineX * TILE_SIZE;
  const sy = TILE_INSET + cfg.shineY * TILE_SIZE;
  const sr = cfg.shineSpread * TILE_SIZE;
  if (cfg.shineIntensity > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const sheen = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 1.4);
    sheen.addColorStop(0, `rgba(255, 255, 255, ${0.28 * cfg.shineIntensity})`);
    sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, ICON_SIZE, ICON_SIZE);
    ctx.restore();
  }

  // 6. Rim light: a hairline inside the edge, brightest at the top, plus the shine's specular catch.
  if (cfg.rimLight > 0) {
    const rim = ctx.createLinearGradient(0, TILE_INSET, 0, TILE_INSET + TILE_SIZE);
    rim.addColorStop(0, `rgba(255, 255, 255, ${0.55 * cfg.rimLight})`);
    rim.addColorStop(0.35, `rgba(255, 255, 255, ${0.08 * cfg.rimLight})`);
    rim.addColorStop(1, `rgba(255, 255, 255, ${0.14 * cfg.rimLight})`);
    ctx.lineWidth = cfg.rimWidth * 2;
    ctx.strokeStyle = rim;
    ctx.stroke(tile);
  }
  if (cfg.shineIntensity > 0) {
    const spec = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    spec.addColorStop(0, `rgba(255, 255, 255, ${0.95 * cfg.shineIntensity})`);
    spec.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.lineWidth = (cfg.rimWidth + 2) * 2;
    ctx.strokeStyle = spec;
    ctx.stroke(tile);
  }
  ctx.restore();

  // 7. Grain over everything on the tile, like onboarding's film grain: signed (lightens and darkens equally),
  // desaturated, seeded. Two sparse layers drawn source-atop, so nothing is read back from the canvas.
  if (cfg.grainAmount > 0) {
    const cells = Math.max(16, Math.ceil(ICON_SIZE / cfg.grainSize));
    const light = document.createElement("canvas");
    const dark = document.createElement("canvas");
    light.width = dark.width = cells;
    light.height = dark.height = cells;
    const lctx = light.getContext("2d");
    const dctx = dark.getContext("2d");
    if (lctx && dctx) {
      const li = lctx.createImageData(cells, cells);
      const di = dctx.createImageData(cells, cells);
      for (let i = 0; i < cells * cells; i++) {
        const n = rnd() * 2 - 1;
        const at = i * 4;
        li.data[at] = li.data[at + 1] = li.data[at + 2] = 255;
        li.data[at + 3] = n > 0 ? Math.round(n * 255) : 0;
        di.data[at + 3] = n < 0 ? Math.round(-n * 255) : 0;
      }
      lctx.putImageData(li, 0, 0);
      dctx.putImageData(di, 0, 0);
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      ctx.imageSmoothingEnabled = cfg.grainSize > 1.5;
      ctx.globalAlpha = cfg.grainAmount * 0.16;
      ctx.drawImage(light, 0, 0, ICON_SIZE, ICON_SIZE);
      ctx.globalAlpha = cfg.grainAmount * 0.3;
      ctx.drawImage(dark, 0, 0, ICON_SIZE, ICON_SIZE);
      ctx.restore();
    }
  }
}

/** Draws `source` (1024) into `target` at `px` CSS pixels, halving step by step so small sizes stay clean. */
export function downscaleInto(
  source: HTMLCanvasElement,
  target: HTMLCanvasElement,
  px: number,
  dpr: number
): void {
  const size = Math.max(1, Math.round(px * dpr));
  let current: HTMLCanvasElement = source;
  while (current.width / 2 >= size) {
    const half = document.createElement("canvas");
    half.width = Math.max(size, Math.round(current.width / 2));
    half.height = half.width;
    const hctx = half.getContext("2d");
    if (!hctx) break;
    hctx.imageSmoothingQuality = "high";
    hctx.drawImage(current, 0, 0, half.width, half.height);
    current = half;
  }
  target.width = size;
  target.height = size;
  const tctx = target.getContext("2d");
  if (!tctx) return;
  tctx.imageSmoothingQuality = "high";
  tctx.clearRect(0, 0, size, size);
  tctx.drawImage(current, 0, 0, size, size);
}

/** Fills in any keys an older saved config lacks, so recalled configs always render. */
export function normalizeConfig(value: Partial<AppIconConfig> | null | undefined): AppIconConfig {
  const mode = value?.mode && value.mode in MODE_PRESETS ? value.mode : "dark-mono";
  return { ...MODE_PRESETS[mode].config, ...value, mode };
}
