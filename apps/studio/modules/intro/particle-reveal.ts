/**
 * The startup reveal: drifting particles condense into the logo from left to right, the solid mark resolves behind
 * the front and a sheen crosses it. Ported from the “particle reveal” prototype; shaders and timing are unchanged
 * apart from per-shape brightness, so “motion” settles muted like the header's.
 */

export const REVEAL_SECONDS = 8.5;
/** When the sheen has crossed and the mark is still: the moment it can hand over to the page. */
export const REVEAL_SETTLED_SECONDS = 8;

export type RevealShape = { d: string; tone: number };
export type ParticleReveal = {
  /** Draws the take at `t` seconds; `clock` drives the ambient drift and keeps running once `t` stops. */
  render(t: number, clock: number): void;
  /** Where the logo's ink sits on screen in the last frame drawn, in CSS pixels. */
  logoRect(): { left: number; top: number; width: number; height: number };
  destroy(): void;
};

const FOV = (30 * Math.PI) / 180;
const TAN = Math.tan(FOV / 2);
/** The prototype's letterbox left this share of the height clear; the logo is still fitted to it. */
const CLEAR = 0.7;

const PARTICLE_VS = `
  precision highp float;
  attribute vec3 aTarget;
  attribute vec4 aRand;
  uniform mat4 uView, uProj;
  uniform float uSweep, uTime, uPx, uFocus, uBase, uFloor, uFade;
  varying float vAlpha, vSoft, vGlow;

  vec3 flow(vec3 p) {
    return vec3(
      sin(p.y * 1.7 + 1.3 * sin(p.z * 1.3 + p.x * 0.7)),
      sin(p.z * 1.9 + 1.3 * sin(p.x * 1.1 + p.y * 0.9)),
      sin(p.x * 1.5 + 1.3 * sin(p.y * 1.7 + p.z * 0.5)));
  }

  void main() {
    vec3 pos;
    float b;
    float heat;

    if (aTarget.z < 0.5) {
      // Logo particle; z / 0.4 is the brightness its shape settles at.
      float tone = aTarget.z / 0.4;
      float u = (uSweep - aTarget.x - aRand.x * 0.4) / 0.6;
      float p = clamp(u, 0.0, 1.0);
      float s = p * p * (3.0 - 2.0 * p);
      float k = (1.0 - s) * (1.0 - s);
      float ahead = clamp(-u, 0.0, 4.0);

      vec3 sd = vec3(aTarget.xy * 1.4, aRand.y * 0.9);
      vec3 n = flow(sd + vec3(0.0, uTime * 0.07, uTime * 0.11))
             + 0.5 * flow(sd * 2.7 - vec3(uTime * 0.13, 0.0, 0.0));
      vec3 disp = vec3(0.25 + 0.75 * aRand.z, (aRand.w - 0.5) * 0.55, (aRand.y - 0.5) * 1.7)
                + n * vec3(0.28, 0.34, 0.6);

      pos = vec3(aTarget.xy, 0.0) + disp * k * (1.0 + 0.18 * ahead);
      float arc = sin(p * 3.14159);
      pos.y += arc * (aRand.w - 0.5) * 0.16;
      pos.z += arc * (aRand.z - 0.5) * 0.35;

      float appear = smoothstep(-2.6, -0.2, u);
      appear *= appear;
      heat = smoothstep(0.05, 0.45, p) * (1.0 - smoothstep(0.7, 1.0, p));
      float settled = smoothstep(0.9, 1.0, p);
      float glint = step(0.965, aRand.z)
                  * pow(max(0.0, sin(uTime * (0.6 + aRand.y * 1.8) + aRand.w * 60.0)), 18.0);
      b = (appear * (0.13 + 1.25 * heat) * mix(1.0, 0.1, settled) + settled * glint * 1.4) * mix(1.0, tone, p);
    } else {
      vec3 base = vec3(aTarget.xy, (aRand.y - 0.5) * 3.4);
      pos = base + 0.22 * flow(base * 0.6 + vec3(uTime * 0.05, 0.0, aRand.x * 6.0));
      float lit = exp(-pow((pos.x - uSweep + 0.2) / 0.55, 2.0));
      heat = lit * 0.6;
      b = 0.22 + 0.34 * aRand.w + 0.9 * lit;
    }

    vec4 mv = uView * vec4(pos, 1.0);
    float dist = max(-mv.z, 0.05);
    float ideal = uBase * (0.8 + 0.5 * aRand.y) / dist;
    float crisp = max(ideal, 1.4);
    float coc = 0.08 * abs(dist - uFocus) / uFocus * uPx / dist;
    float size = min(crisp + coc, 56.0);
    vSoft = clamp(coc / 7.0, 0.0, 1.0);

    float lum = b * uFade;
    float energy = lum * (ideal * crisp) / (size * size) * mix(1.0, 2.2, vSoft);
    vAlpha = max(energy, uFloor * step(0.03, lum));
    vGlow = 0.2 + 1.6 * heat;

    gl_Position = uProj * mv;
    gl_PointSize = size;
    if (lum < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }`;

const PARTICLE_FS = `
  precision highp float;
  varying float vAlpha, vSoft, vGlow;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float core = smoothstep(1.0, 0.0, r);
    core *= core;
    float disc = smoothstep(1.0, 0.84, r) * (0.7 + 0.45 * smoothstep(0.45, 0.95, r));
    float a = vAlpha * mix(core * 1.6, disc, vSoft);
    gl_FragColor = vec4(vec3(0.93, 0.96, 1.0) * a, a * vGlow);
  }`;

const FILL_VS = `
  precision highp float;
  attribute vec2 aPos;
  attribute vec2 aUv;
  uniform mat4 uView, uProj;
  varying vec2 vUv, vP;
  void main() {
    vUv = aUv;
    vP = aPos;
    gl_Position = uProj * uView * vec4(aPos, 0.0, 1.0);
  }`;

const FILL_FS = `
  precision highp float;
  uniform sampler2D uLogo;
  uniform float uSweep, uSheen, uSettle, uFade;
  varying vec2 vUv, vP;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec4 logo = texture2D(uLogo, vUv);
    float m = logo.a;
    float tone = logo.r;
    float behind = uSweep - vP.x;
    float r = smoothstep(0.62, 1.05, behind - hash(floor(vP * 420.0)) * 0.22);
    float hot = 1.0 - smoothstep(0.7, 1.9, behind);
    float sheen = exp(-pow((vP.x + vP.y * 0.55 - uSheen) / 0.16, 2.0));
    float lum = (mix(0.9, 1.0, uSettle) + 0.55 * hot + 0.5 * sheen) * tone;
    float a = m * r * uFade;
    gl_FragColor = vec4(vec3(lum) * a, a * (0.35 * hot + 0.5 * sheen) * tone);
  }`;

const POST_VS = `
  attribute vec2 aP;
  varying vec2 vUv;
  void main() {
    vUv = aP * 0.5 + 0.5;
    gl_Position = vec4(aP, 0.0, 1.0);
  }`;

const DOWN_FS = `
  precision highp float;
  uniform sampler2D uTex;
  uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    float a = texture2D(uTex, vUv + uTexel * vec2(-1.0, -1.0)).a
            + texture2D(uTex, vUv + uTexel * vec2( 1.0, -1.0)).a
            + texture2D(uTex, vUv + uTexel * vec2(-1.0,  1.0)).a
            + texture2D(uTex, vUv + uTexel * vec2( 1.0,  1.0)).a;
    gl_FragColor = vec4(vec3(min(a * 0.25, 6.0)), 1.0);
  }`;

const BLUR_FS = `
  precision highp float;
  uniform sampler2D uTex;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(uTex, vUv).rgb * 0.227027;
    c += (texture2D(uTex, vUv + uDir).rgb + texture2D(uTex, vUv - uDir).rgb) * 0.1945946;
    c += (texture2D(uTex, vUv + uDir * 2.0).rgb + texture2D(uTex, vUv - uDir * 2.0).rgb) * 0.1216216;
    c += (texture2D(uTex, vUv + uDir * 3.0).rgb + texture2D(uTex, vUv - uDir * 3.0).rgb) * 0.054054;
    c += (texture2D(uTex, vUv + uDir * 4.0).rgb + texture2D(uTex, vUv - uDir * 4.0).rgb) * 0.016216;
    gl_FragColor = vec4(c, 1.0);
  }`;

const GRADE_FS = `
  precision highp float;
  uniform sampler2D uScene, uGlow, uStreak;
  uniform float uTime;
  varying vec2 vUv;
  float hash(vec2 p) {
    p = 50.0 * fract(p * 0.3183099 + vec2(0.71, 0.113));
    return fract(p.x * p.y * (p.x + p.y));
  }
  vec3 knee(vec3 x) {
    const float k = 0.88;
    return min(x, k) + (1.0 - k) * (1.0 - exp(-max(x - k, 0.0) / (1.0 - k)));
  }
  void main() {
    vec2 c = vUv - 0.5;
    vec2 off = c * dot(c, c) * 0.009;
    vec3 col = vec3(
      texture2D(uScene, vUv - off).r,
      texture2D(uScene, vUv).g,
      texture2D(uScene, vUv + off).b);
    col += texture2D(uGlow, vUv).r * 0.5 * vec3(0.85, 0.92, 1.0);
    col += texture2D(uStreak, vUv).r * 1.1 * vec3(0.36, 0.58, 1.0);
    col += vec3(0.010, 0.012, 0.017) * (1.0 - 1.6 * dot(c, c));
    col *= 1.0 - 0.6 * smoothstep(0.3, 0.8, length(c * vec2(1.0, 0.9)));
    col = knee(col);
    float n = hash(floor(gl_FragCoord.xy) + floor(fract(uTime * vec2(1.0, 1.37)) * 1024.0)) - 0.5;
    col += n * 0.045 * (1.0 - 0.6 * dot(col, vec3(0.333)));
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }`;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
const ramp = (a: number, b: number, x: number) => smooth(clamp01((x - a) / (b - a)));
const mix = (a: number, b: number, x: number) => a + (b - a) * x;

function perspective(aspect: number, near: number, far: number): Float32Array {
  const f = 1 / TAN;
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + near) * nf,
    -1,
    0,
    0,
    2 * far * near * nf,
    0,
  ]);
}

function lookAtOrigin(ex: number, ey: number, ez: number): Float32Array {
  let l = Math.hypot(ex, ey, ez);
  const zx = ex / l;
  const zy = ey / l;
  const zz = ez / l;
  l = Math.hypot(zz, zx);
  const xx = zz / l;
  const xz = -zx / l;
  const yx = zy * xz;
  const yy = zz * xx - zx * xz;
  const yz = -zy * xx;
  return new Float32Array([
    xx,
    yx,
    zx,
    0,
    0,
    yy,
    zy,
    0,
    xz,
    yz,
    zz,
    0,
    -(xx * ex + xz * ez),
    -(yx * ex + yy * ey + yz * ez),
    -(zx * ex + zy * ey + zz * ez),
    1,
  ]);
}

/** Column-major 4×4 times (x, y, 0, 1). */
function transform(m: Float32Array, x: number, y: number): [number, number, number, number] {
  return [
    m[0] * x + m[4] * y + m[12],
    m[1] * x + m[5] * y + m[13],
    m[2] * x + m[6] * y + m[14],
    m[3] * x + m[7] * y + m[15],
  ];
}

function seededRandom(start: number): () => number {
  let seed = start;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sets up the reveal on `canvas`; null when the browser has no WebGL, so the caller shows the logo instead. */
export function createParticleReveal(
  canvas: HTMLCanvasElement,
  shapes: RevealShape[],
  viewBox: { x: number; y: number; width: number; height: number }
): ParticleReveal | null {
  const options = {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  };
  const gl2 = canvas.getContext("webgl2", options) as WebGL2RenderingContext | null;
  const context = (gl2 ?? canvas.getContext("webgl", options)) as WebGLRenderingContext | null;
  if (!context) return null;
  const gl: WebGLRenderingContext = context;
  // Named so the hooks lint doesn't read WebGL's `useProgram` as a React hook.
  const bindProgram = gl.useProgram.bind(gl);
  let hdr =
    !!gl2 && !!(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"));
  const small = Math.min(innerWidth, innerHeight) < 520 || matchMedia("(pointer: coarse)").matches;

  // Sample the artwork: brightness in red, coverage in alpha.
  const TW = 2048;
  const TH = 512;
  const raster = document.createElement("canvas");
  raster.width = TW;
  raster.height = TH;
  const r2d = raster.getContext("2d", { willReadFrequently: true });
  if (!r2d) return null;
  const fit = Math.min(TW / viewBox.width, TH / viewBox.height) * 0.92;
  r2d.translate(
    (TW - viewBox.width * fit) / 2 - viewBox.x * fit,
    (TH - viewBox.height * fit) / 2 - viewBox.y * fit
  );
  r2d.scale(fit, fit);
  for (const shape of shapes) {
    const level = Math.round(shape.tone * 255);
    r2d.fillStyle = `rgb(${level}, ${level}, ${level})`;
    r2d.fill(new Path2D(shape.d));
  }
  const px = r2d.getImageData(0, 0, TW, TH).data;

  let inside = 0;
  let minX = TW;
  let maxX = 0;
  let minY = TH;
  let maxY = 0;
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
      if (px[(y * TW + x) * 4 + 3] > 127) {
        inside++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const unit = (maxX - minX) / 2;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const logoHalfH = (maxY - minY) / 2 / unit;

  const rnd = seededRandom(0x2f6e2b1);
  const wanted = small ? 90000 : 190000;
  const step = Math.sqrt(inside / wanted);
  const pts: number[] = [];
  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      const jx = x + (rnd() - 0.5) * step;
      const jy = y + (rnd() - 0.5) * step;
      const ix = jx | 0;
      const iy = jy | 0;
      if (ix < 0 || iy < 0 || ix >= TW || iy >= TH) continue;
      const at = (iy * TW + ix) * 4;
      if (px[at + 3] > 127) pts.push((jx - cx) / unit, -(jy - cy) / unit, px[at] / 255);
    }
  }
  const logoCount = pts.length / 3;
  for (let i = logoCount - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    for (let k = 0; k < 3; k++) {
      const swap = pts[i * 3 + k];
      pts[i * 3 + k] = pts[j * 3 + k];
      pts[j * 3 + k] = swap;
    }
  }
  const dustCount = small ? 1400 : 2600;
  const total = dustCount + logoCount;
  const targets = new Float32Array(total * 3);
  const rands = new Float32Array(total * 4);
  for (let i = 0; i < total; i++) {
    if (i < dustCount) {
      targets[i * 3] = (rnd() - 0.5) * 5.4;
      targets[i * 3 + 1] = (rnd() - 0.5) * 3.0;
      targets[i * 3 + 2] = 1;
    } else {
      const k = (i - dustCount) * 3;
      targets[i * 3] = pts[k];
      targets[i * 3 + 1] = pts[k + 1];
      targets[i * 3 + 2] = pts[k + 2] * 0.4;
    }
    for (let k = 0; k < 4; k++) rands[i * 4 + k] = rnd();
  }
  const spacing = step / unit;

  type Program = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };
  const shaders: WebGLShader[] = [];
  function program(vsSrc: string, fsSrc: string, attribs: string[]): Program {
    const p = gl.createProgram();
    if (!p) throw new Error("Couldn't create a WebGL program");
    for (const [type, src] of [
      [gl.VERTEX_SHADER, vsSrc],
      [gl.FRAGMENT_SHADER, fsSrc],
    ] as const) {
      const s = gl.createShader(type);
      if (!s) throw new Error("Couldn't create a WebGL shader");
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      gl.attachShader(p, s);
      shaders.push(s);
    }
    attribs.forEach((name, i) => gl.bindAttribLocation(p, i, name));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "program");
    const u: Program["u"] = {};
    const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const name = gl.getActiveUniform(p, i)?.name;
      if (name) u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  }

  let programs: Program[];
  try {
    programs = [
      program(PARTICLE_VS, PARTICLE_FS, ["aTarget", "aRand"]),
      program(FILL_VS, FILL_FS, ["aPos", "aUv"]),
      program(POST_VS, DOWN_FS, ["aP"]),
      program(POST_VS, BLUR_FS, ["aP"]),
      program(POST_VS, GRADE_FS, ["aP"]),
    ];
  } catch (error) {
    console.error(error);
    return null;
  }
  const [pParticles, pFill, pDown, pBlur, pGrade] = programs;

  const buffers: WebGLBuffer[] = [];
  const buffer = (data: Float32Array) => {
    const b = gl.createBuffer();
    if (!b) throw new Error("Couldn't create a WebGL buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    buffers.push(b);
    return b;
  };
  const bTargets = buffer(targets);
  const bRands = buffer(rands);
  const qx0 = -cx / unit;
  const qx1 = (TW - cx) / unit;
  const qy0 = -(TH - cy) / unit;
  const qy1 = cy / unit;
  const bQuad = buffer(new Float32Array([qx0, qy0, 0, 0, qx1, qy0, 1, 0, qx0, qy1, 0, 1, qx1, qy1, 1, 1]));
  const bTri = buffer(new Float32Array([-1, -1, 3, -1, -1, 3]));

  const logoTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, logoTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, raster);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  type Target = { tex: WebGLTexture | null; fbo: WebGLFramebuffer | null; w: number; h: number; ok: boolean };
  function makeTarget(w: number, h: number): Target {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (hdr && gl2) gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.RGBA16F, w, h, 0, gl2.RGBA, gl2.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    return { tex, fbo, w, h, ok };
  }
  const freeTarget = (target: Target | null) => {
    if (!target) return;
    gl.deleteTexture(target.tex);
    gl.deleteFramebuffer(target.fbo);
  };

  let scene: Target | null = null;
  let blurA: Target | null = null;
  let blurB: Target | null = null;
  let blurC: Target | null = null;

  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(2, Math.round(canvas.clientHeight * dpr));
    if (scene && w === canvas.width && h === canvas.height) return;
    canvas.width = w;
    canvas.height = h;
    for (const target of [scene, blurA, blurB, blurC]) freeTarget(target);
    scene = makeTarget(w, h);
    if (hdr && !scene.ok) {
      hdr = false;
      freeTarget(scene);
      scene = makeTarget(w, h);
    }
    const qw = Math.max(2, w >> 2);
    const qh = Math.max(2, h >> 2);
    blurA = makeTarget(qw, qh);
    blurB = makeTarget(qw, qh);
    blurC = makeTarget(qw, qh);
  }

  function bindTex(slot: number, tex: WebGLTexture | null, loc: WebGLUniformLocation | null): void {
    gl.activeTexture(gl.TEXTURE0 + slot);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, slot);
  }
  function post(prog: Program, target: Target | null, setUniforms: (u: Program["u"]) => void): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.w : canvas.width, target ? target.h : canvas.height);
    bindProgram(prog.p);
    setUniforms(prog.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  let lastView: Float32Array = new Float32Array(16);
  let lastProj: Float32Array = new Float32Array(16);

  function render(t: number, clock: number): void {
    resize();
    if (!scene || !blurA || !blurB || !blurC) return;
    const sceneTarget = scene;
    const [a, b, c] = [blurA, blurB, blurC];
    const w = canvas.width;
    const h = canvas.height;
    const aspect = w / h;

    const sweepX = clamp01((t - 0.2) / 6.2);
    const sweep = -2.5 + 5.5 * (0.35 * sweepX + 0.65 * smooth(sweepX));
    const fade = ramp(0, 0.9, t);
    const settle = ramp(5.8, 7.6, t);
    const sheen = mix(-1.7, 1.9, ramp(6.2, 8.0, t));

    const fitW = mix(0.7, 0.46, clamp01((aspect - 0.7) / 0.9));
    const fitDist = Math.max(1 / (fitW * TAN * aspect), logoHalfH / (0.46 * CLEAR * TAN));
    const move = 1 - (1 - Math.min(1, t / REVEAL_SECONDS)) ** 3;
    const dist = fitDist * mix(1.16, 1, move);
    const yaw = mix(-0.16, 0, move) + Math.sin(clock * 0.15) * 0.012 * (1 - move);
    const pitch = mix(0.05, 0, move) + Math.sin(clock * 0.11) * 0.008 * (1 - move);
    const view = lookAtOrigin(
      Math.sin(yaw) * Math.cos(pitch) * dist,
      Math.sin(pitch) * dist,
      Math.cos(yaw) * Math.cos(pitch) * dist
    );
    const proj = perspective(aspect, 0.1, 50);
    lastView = view;
    lastProj = proj;
    const pxScale = h / (2 * TAN);

    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneTarget.fbo);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);

    bindProgram(pFill.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, bQuad);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    gl.uniformMatrix4fv(pFill.u.uView, false, view);
    gl.uniformMatrix4fv(pFill.u.uProj, false, proj);
    gl.uniform1f(pFill.u.uSweep, sweep);
    gl.uniform1f(pFill.u.uSheen, sheen);
    gl.uniform1f(pFill.u.uSettle, settle);
    gl.uniform1f(pFill.u.uFade, fade);
    bindTex(0, logoTex, pFill.u.uLogo);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    bindProgram(pParticles.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, bTargets);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bRands);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(pParticles.u.uView, false, view);
    gl.uniformMatrix4fv(pParticles.u.uProj, false, proj);
    gl.uniform1f(pParticles.u.uSweep, sweep);
    gl.uniform1f(pParticles.u.uTime, clock);
    gl.uniform1f(pParticles.u.uPx, pxScale);
    gl.uniform1f(pParticles.u.uFocus, dist);
    gl.uniform1f(pParticles.u.uBase, spacing * pxScale * 1.3);
    gl.uniform1f(pParticles.u.uFloor, hdr ? 0 : 0.008);
    gl.uniform1f(pParticles.u.uFade, fade);
    gl.drawArrays(gl.POINTS, 0, total);

    gl.disable(gl.BLEND);
    gl.disableVertexAttribArray(1);
    gl.bindBuffer(gl.ARRAY_BUFFER, bTri);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    post(pDown, a, (u) => {
      bindTex(0, sceneTarget.tex, u.uTex);
      gl.uniform2f(u.uTexel, 1 / w, 1 / h);
    });
    post(pBlur, b, (u) => {
      bindTex(0, a.tex, u.uTex);
      gl.uniform2f(u.uDir, 1.6 / a.w, 0);
    });
    post(pBlur, a, (u) => {
      bindTex(0, b.tex, u.uTex);
      gl.uniform2f(u.uDir, 0, 1.6 / a.h);
    });
    // Two horizontal-only passes stretch the glow into an anamorphic streak.
    post(pBlur, c, (u) => {
      bindTex(0, a.tex, u.uTex);
      gl.uniform2f(u.uDir, 0.006, 0);
    });
    post(pBlur, b, (u) => {
      bindTex(0, c.tex, u.uTex);
      gl.uniform2f(u.uDir, 0.018, 0);
    });
    post(pGrade, null, (u) => {
      bindTex(0, sceneTarget.tex, u.uScene);
      bindTex(1, a.tex, u.uGlow);
      bindTex(2, b.tex, u.uStreak);
      gl.uniform1f(u.uTime, clock);
    });
  }

  function logoRect(): { left: number; top: number; width: number; height: number } {
    const box = canvas.getBoundingClientRect();
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const [x, y] of [
      [-1, -logoHalfH],
      [1, -logoHalfH],
      [-1, logoHalfH],
      [1, logoHalfH],
    ]) {
      const [vx, vy, vz, vw] = transform(lastView, x, y);
      const view = new Float32Array([vx, vy, vz, vw]);
      const [cxp, cyp, , cw] = transform4(lastProj, view);
      const sx = box.left + ((cxp / cw + 1) / 2) * box.width;
      const sy = box.top + ((1 - cyp / cw) / 2) * box.height;
      left = Math.min(left, sx);
      right = Math.max(right, sx);
      top = Math.min(top, sy);
      bottom = Math.max(bottom, sy);
    }
    return { left, top, width: right - left, height: bottom - top };
  }

  function destroy(): void {
    for (const target of [scene, blurA, blurB, blurC]) freeTarget(target);
    for (const b of buffers) gl.deleteBuffer(b);
    for (const p of programs) gl.deleteProgram(p.p);
    for (const s of shaders) gl.deleteShader(s);
    gl.deleteTexture(logoTex);
  }

  return { render, logoRect, destroy };
}

function transform4(m: Float32Array, v: Float32Array): [number, number, number, number] {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
    m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3],
  ];
}
