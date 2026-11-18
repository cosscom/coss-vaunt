/**
 * A light that orbits an element's border, ported from the “BorderBeam” shader playground. One shared WebGL context
 * renders every beam and copies each frame into that beam's own 2D canvas; the loop runs only while one is lit.
 */

const HPI = Math.PI / 2;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const BEAM_PALETTES = {
  prism: ["#58e6a0", "#ff7ab8", "#ffb46b", "#6aa8ff"],
  aurora: ["#5ff0c8", "#7ad7ff", "#c59bff", "#ff9ad5"],
  ember: ["#ff5a3c", "#ff9a3c", "#ffd36b", "#ff3c7a"],
  ocean: ["#3ce0ff", "#3c8bff", "#6bffd9", "#9ab8ff"],
  mono: ["#ffffff", "#aab2c0", "#ffffff", "#7f8899"],
} as const;
const SUCCESS_PALETTE = ["#4ade80", "#a7f3d0", "#22c55e", "#d9f99d"];

/**
 * Idle is dark. Active orbits the beam; success eases it into a green ring around the whole border, slower, so a
 * finished task glows in place. Every value eases between states, so changes glide.
 */
export type BeamState = "idle" | "active" | "success";
export type BeamPalette = keyof typeof BEAM_PALETTES;

export type BeamOptions = {
  palette: BeamPalette;
  /** Revolutions per second. */
  speed: number;
  /** Beam length as a share of the perimeter. */
  length: number;
  /** How far the comet tail trails the head. */
  tail: number;
  /** Hairline width, px. */
  line: number;
  /** Inner glow reach, px. */
  glow: number;
  strength: number;
  /** Outer bloom reach, px. */
  bloom: number;
  shimmer: number;
  /** How much of the palette one beam spans. */
  spread: number;
  intensity: number;
  /** Render scale against the device pixel ratio. */
  quality: number;
};

/** Tuned in the playground for the agent composer. */
export const COMPOSER_BEAM: BeamOptions = {
  palette: "ocean",
  speed: 0.24,
  length: 0.43,
  tail: 0.6,
  line: 1,
  glow: 34,
  strength: 0.77,
  bloom: 8,
  shimmer: 0,
  spread: 0.7,
  intensity: 0.38,
  quality: 0.7,
};

/** Scene cards are small: the composer's faint settings barely show on them, so they burn brighter and tighter. */
export const CARD_BEAM: BeamOptions = {
  ...COMPOSER_BEAM,
  length: 0.36,
  glow: 26,
  strength: 1.1,
  intensity: 0.95,
};

const EASED = [
  "speed",
  "length",
  "tail",
  "line",
  "glow",
  "strength",
  "bloom",
  "shimmer",
  "spread",
  "intensity",
  "flowRate",
  "ring",
] as const;
type Eased = Record<(typeof EASED)[number], number>;

const UNIFORMS = [
  "u_canvas",
  "u_size",
  "u_sigma",
  "u_noiseK",
  "u_scale",
  "u_radius",
  "u_head",
  "u_count",
  "u_lenPx",
  "u_ring",
  "u_line",
  "u_glow",
  "u_strength",
  "u_bloom",
  "u_outset",
  "u_shimmer",
  "u_time",
  "u_flow",
  "u_spread",
  "u_alpha",
  "u_c0",
  "u_c1",
  "u_c2",
  "u_c3",
] as const;

const VERT = "attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }";

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_canvas, u_size, u_sigma, u_noiseK;
uniform float u_scale, u_radius, u_head, u_count, u_lenPx, u_ring, u_line, u_glow;
uniform float u_strength, u_bloom, u_outset, u_shimmer, u_time, u_flow, u_spread, u_alpha;
uniform vec3 u_c0, u_c1, u_c2, u_c3;

const float HPI = 1.5707963;
const float TAU = 6.2831853;

vec3 palette(float c) {
  c = fract(c) * 4.0;
  float i = floor(c);
  float f = c - i;
  f = f * f * (3.0 - 2.0 * f);
  vec3 a = i < 1.0 ? u_c0 : i < 2.0 ? u_c1 : i < 3.0 ? u_c2 : u_c3;
  vec3 b = i < 1.0 ? u_c1 : i < 2.0 ? u_c2 : i < 3.0 ? u_c3 : u_c0;
  return mix(a, b, f);
}

void main() {
  vec2 p = gl_FragCoord.xy / u_scale;
  p.y = u_canvas.y - p.y;
  p -= 0.5 * u_canvas;

  vec2 b = 0.5 * u_size;
  float r = u_radius;
  vec2 s = b - r;
  vec2 q = abs(p);
  vec2 e = q - s;
  float d = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - r;
  float aa = 0.75 / u_scale;

  if (d > u_outset + aa || -d > u_glow + u_line + aa) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float arc = HPI * r;
  float Q = s.x + arc + s.y;
  float L = 4.0 * Q;
  float u;
  if (e.x > 0.0 && e.y > 0.0) u = s.x + (HPI - atan(e.y, e.x)) * r;
  else if (b.y - q.y < b.x - q.x) u = min(q.x, s.x);
  else u = s.x + arc + s.y - min(q.y, s.y);
  float t = p.x >= 0.0 ? (p.y < 0.0 ? u : 2.0 * Q - u) : (p.y >= 0.0 ? 2.0 * Q + u : L - u);

  float seg = L / u_count;
  float x = mod(t - u_head + 0.5 * seg, seg) - 0.5 * seg;
  float sg = x > 0.0 ? u_sigma.x : u_sigma.y;
  float prof = mix(exp(-(x * x) / (sg * sg)), 1.0, u_ring);
  float hot = prof * prof * prof * (1.0 - 0.75 * u_ring);

  float ang = t / L * TAU;
  float n = 0.5 + 0.5 * sin(ang * u_noiseK.x + u_time * 2.1) * sin(ang * u_noiseK.y - u_time * 1.3 + 1.7);
  float shim = 1.0 - u_shimmer * 0.7 * n;

  float inMask = 1.0 - smoothstep(-aa, aa, d);
  float hw = 0.5 * u_line;
  float line = (1.0 - smoothstep(hw - aa, hw + aa, abs(d + hw))) * step(0.01, u_line);

  float reach = max(u_glow * (0.3 + 0.7 * prof), 0.001);
  float f = clamp(1.0 + d / reach, 0.0, 1.0);
  float f2 = f * f;
  float glow = inMask * (f2 * 0.55 + f2 * f2 * hot * 0.5) * prof * u_strength * shim * (1.0 - 0.45 * u_ring);

  float fb = clamp(1.0 - max(d, 0.0) / max(u_bloom, 0.001), 0.0, 1.0);
  float bloom = (1.0 - inMask) * fb * fb * fb * prof * 0.55 * step(0.5, u_bloom);

  vec3 col = palette(mix(x / u_lenPx * u_spread, t / L, u_ring) + u_flow);
  vec3 rgb = col * (glow + bloom) + mix(col, vec3(1.0), 0.2 + 0.6 * hot) * line * prof;
  rgb = min(rgb * u_alpha, 1.0);

  float a0 = max(rgb.r, max(rgb.g, rgb.b));
  float dn = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  rgb = max(rgb + dn * smoothstep(0.0, 0.02, a0), 0.0);
  gl_FragColor = vec4(rgb, max(rgb.r, max(rgb.g, rgb.b)));
}`;

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** The element's corner radius: the first element down its first-child chain that has one. */
function borderRadius(host: HTMLElement, w: number, h: number): number {
  for (let el = host.firstElementChild; el; el = el.firstElementChild) {
    const value = getComputedStyle(el).borderTopLeftRadius;
    const r = Number.parseFloat(value) || 0;
    if (r > 0) return value.includes("%") ? (r / 100) * Math.min(w, h) : r;
  }
  return 0;
}

/** One beam: the element it lights and its canvas, with eased values chasing the targets. */
export class Beam {
  readonly host: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  on = false;
  visible = true;
  asleep = true;
  alpha = 0;
  head = 0;
  phase = 0;
  flow = Math.random();
  w = 0;
  h = 0;
  r = 0;
  cw = 0;
  ch = 0;
  pw = 0;
  ph = 0;
  outset = 0;
  L = 1;
  options: BeamOptions = COMPOSER_BEAM;
  target: Eased = {
    speed: 0,
    length: 0,
    tail: 0,
    line: 0,
    glow: 0,
    strength: 0,
    bloom: 0,
    shimmer: 0,
    spread: 0,
    intensity: 0,
    flowRate: 0,
    ring: 0,
  };
  current: Eased = { ...this.target };
  palette = new Float32Array(12);
  currentPalette = new Float32Array(12);

  constructor(host: HTMLElement, canvas: HTMLCanvasElement) {
    this.host = host;
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't get a 2D context for the beam");
    this.ctx = ctx;
  }

  set(options: BeamOptions, state: BeamState): void {
    this.options = options;
    this.on = state !== "idle";
    const success = state === "success";
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const speed = still ? 0 : options.speed * (success ? 0.6 : 1);
    this.target = {
      speed,
      length: clamp(options.length, 0.02, 1),
      tail: success ? 0 : options.tail,
      line: options.line,
      glow: options.glow,
      strength: options.strength,
      bloom: options.bloom,
      shimmer: still ? 0 : options.shimmer,
      spread: options.spread,
      intensity: options.intensity,
      flowRate: still ? 0 : 0.04 + 0.14 * speed,
      ring: success ? 1 : 0,
    };
    const colors = success ? SUCCESS_PALETTE : BEAM_PALETTES[options.palette];
    for (let i = 0; i < 4; i++) this.palette.set(hexToRgb(colors[i]), i * 3);
    this.layout();
  }

  layout(): void {
    const w = this.host.offsetWidth;
    const h = this.host.offsetHeight;
    if (!w || !h) {
      this.pw = 0;
      return;
    }
    const outset = this.options.bloom > 0.5 ? Math.ceil(this.options.bloom) + 1 : 0;
    const scale = Math.min(devicePixelRatio || 1, 2) * clamp(this.options.quality, 0.25, 1);
    const cw = w + outset * 2;
    const ch = h + outset * 2;
    const pw = Math.max(1, Math.round(cw * scale));
    const ph = Math.max(1, Math.round(ch * scale));
    if (pw !== this.pw || ph !== this.ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
      this.ctx.globalCompositeOperation = "copy";
    }
    if (cw !== this.cw || ch !== this.ch || outset !== this.outset) {
      Object.assign(this.canvas.style, {
        width: `${cw}px`,
        height: `${ch}px`,
        transform: `translate(${-outset}px, ${-outset}px)`,
      });
    }
    const r = borderRadius(this.host, w, h);
    Object.assign(this, { w, h, r: Math.min(r, w / 2, h / 2), outset, cw, ch, pw, ph });
  }

  snap(): void {
    Object.assign(this.current, this.target);
    this.currentPalette.set(this.palette);
  }

  step(dt: number): void {
    const k = 1 - Math.exp(-dt * 9);
    for (const key of EASED) this.current[key] += (this.target[key] - this.current[key]) * k;
    for (let i = 0; i < 12; i++) this.currentPalette[i] += (this.palette[i] - this.currentPalette[i]) * k;
    this.alpha += ((this.on ? 1 : 0) - this.alpha) * (1 - Math.exp(-dt * (this.on ? 8 : 5)));
    this.phase = (this.phase + dt * this.current.speed) % 1;
    this.flow = (this.flow + dt * this.current.flowRate) % 1;

    const bx = this.w / 2;
    const by = this.h / 2;
    const r = this.r;
    const quarter = bx - r + HPI * r + by - r;
    const L = 4 * quarter;
    const target = this.phase * L;
    const delta = ((((target - this.head) % L) + 1.5 * L) % L) - 0.5 * L;
    this.head = (this.head + delta * (1 - Math.exp(-dt * 12)) + L) % L;
    this.L = L;
  }
}

type Shared = {
  gl: WebGLRenderingContext;
  canvas: HTMLCanvasElement;
  u: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
  ready: boolean;
};

const beams = new Set<Beam>();
let shared: Shared | null = null;
let failed = false;
let raf = 0;
let last = 0;
let time = 0;
let resizeObserver: ResizeObserver | null = null;
let visibilityObserver: IntersectionObserver | null = null;

function build(state: Shared): void {
  const { gl } = state;
  const compile = (type: number, src: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Couldn't create a beam shader");
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
    return shader;
  };
  const program = gl.createProgram();
  if (!program) throw new Error("Couldn't create the beam program");
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.bindAttribLocation(program, 0, "a");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program) ?? "link");
  // Named so the hooks lint doesn't read WebGL's `useProgram` as a React hook.
  const bindProgram = gl.useProgram.bind(gl);
  bindProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.SCISSOR_TEST);
  gl.clearColor(0, 0, 0, 0);
  for (const name of UNIFORMS) state.u[name] = gl.getUniformLocation(program, name);
  state.ready = true;
}

function setup(): Shared | null {
  if (shared || failed) return shared;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  });
  if (!gl) {
    failed = true;
    return null;
  }
  const state: Shared = { gl, canvas, u: {} as Shared["u"], ready: false };
  try {
    build(state);
  } catch (error) {
    console.error("[BorderBeam]", error);
    failed = true;
    return null;
  }
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    state.ready = false;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    build(state);
    wake();
  });
  shared = state;
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) findBeam(entry.target)?.layout();
    wake();
  });
  visibilityObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const beam = findBeam(entry.target);
        if (beam) beam.visible = entry.isIntersecting;
      }
      wake();
    },
    { rootMargin: "64px" }
  );
  return shared;
}

function findBeam(host: Element): Beam | undefined {
  for (const beam of beams) if (beam.host === host) return beam;
  return undefined;
}

function draw(state: Shared, beam: Beam): void {
  const { gl, canvas, u } = state;
  const c = beam.current;
  const pal = beam.currentPalette;
  const { pw, ph, L } = beam;
  if (canvas.width < pw || canvas.height < ph) {
    canvas.width = Math.max(canvas.width, pw);
    canvas.height = Math.max(canvas.height, ph);
  }
  gl.viewport(0, 0, pw, ph);
  gl.scissor(0, 0, pw, ph);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const lenPx = Math.max(1, Math.min(c.length * L, L * 0.85));
  const half = lenPx * 0.5;
  gl.uniform2f(u.u_canvas, beam.cw, beam.ch);
  gl.uniform2f(u.u_size, beam.w, beam.h);
  gl.uniform2f(u.u_sigma, half * (1 - 0.7 * c.tail), half * (1 + 0.6 * c.tail));
  gl.uniform2f(u.u_noiseK, Math.max(2, Math.round(L / 140)), Math.max(3, Math.round(L / 53)));
  gl.uniform1f(u.u_scale, pw / beam.cw);
  gl.uniform1f(u.u_radius, beam.r);
  gl.uniform1f(u.u_head, beam.head);
  gl.uniform1f(u.u_count, 1);
  gl.uniform1f(u.u_lenPx, lenPx);
  gl.uniform1f(u.u_ring, c.ring);
  gl.uniform1f(u.u_line, c.line);
  gl.uniform1f(u.u_glow, Math.min(c.glow, Math.min(beam.w, beam.h) * 0.5));
  gl.uniform1f(u.u_strength, c.strength);
  gl.uniform1f(u.u_bloom, Math.min(c.bloom, beam.outset));
  gl.uniform1f(u.u_outset, beam.outset);
  gl.uniform1f(u.u_shimmer, c.shimmer);
  gl.uniform1f(u.u_time, time);
  gl.uniform1f(u.u_flow, beam.flow);
  gl.uniform1f(u.u_spread, c.spread);
  gl.uniform1f(u.u_alpha, beam.alpha * c.intensity);
  gl.uniform3f(u.u_c0, pal[0], pal[1], pal[2]);
  gl.uniform3f(u.u_c1, pal[3], pal[4], pal[5]);
  gl.uniform3f(u.u_c2, pal[6], pal[7], pal[8]);
  gl.uniform3f(u.u_c3, pal[9], pal[10], pal[11]);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  beam.ctx.drawImage(canvas, 0, canvas.height - ph, pw, ph, 0, 0, pw, ph);
}

function frame(now: number): void {
  raf = 0;
  const state = shared;
  if (!state?.ready) return;
  const dt = clamp((now - last) / 1000, 0.001, 0.05);
  last = now;
  time += dt;
  let live = 0;
  for (const beam of beams) {
    if (!beam.visible || !beam.pw) continue;
    if (!beam.on && beam.alpha < 0.004) {
      if (!beam.asleep) {
        beam.ctx.clearRect(0, 0, beam.pw, beam.ph);
        beam.asleep = true;
        beam.alpha = 0;
      }
      continue;
    }
    if (beam.asleep) {
      beam.snap();
      beam.asleep = false;
    }
    beam.step(dt);
    draw(state, beam);
    live++;
  }
  if (live) raf = requestAnimationFrame(frame);
}

export function wake(): void {
  if (raf || !shared?.ready) return;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

/** Starts lighting `beam`; false when the browser has no WebGL, so the element simply goes without. */
export function addBeam(beam: Beam): boolean {
  if (!setup()) return false;
  beams.add(beam);
  resizeObserver?.observe(beam.host);
  visibilityObserver?.observe(beam.host);
  wake();
  return true;
}

export function removeBeam(beam: Beam): void {
  if (!beams.delete(beam)) return;
  resizeObserver?.unobserve(beam.host);
  visibilityObserver?.unobserve(beam.host);
}
