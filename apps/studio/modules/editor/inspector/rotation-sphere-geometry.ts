const DEG = Math.PI / 180;
const FINE_STEP = 0.5;
const SNAP_STEP = 15;

function multiply(a: Mat3, b: Mat3): Mat3 {
  const cell = (row: 0 | 1 | 2, col: 0 | 1 | 2) =>
    a[row][0] * b[0][col] + a[row][1] * b[1][col] + a[row][2] * b[2][col];
  return [
    [cell(0, 0), cell(0, 1), cell(0, 2)],
    [cell(1, 0), cell(1, 1), cell(1, 2)],
    [cell(2, 0), cell(2, 1), cell(2, 2)],
  ];
}

const rx = (deg: number): Mat3 => {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
};

const ry = (deg: number): Mat3 => {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
};

const rz = (deg: number): Mat3 => {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
};

/** A great circle through `u` and `v`. */
function greatCircle(u: Vec3, v: Vec3): SphereCircle {
  return { centre: [0, 0, 0], u, v };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function toPath(runs: Point[][]): string {
  return runs
    .filter((run) => run.length > 1)
    .map((run) => run.map((p, i) => `${i === 0 ? "M" : "L"}${round2(p.x)} ${round2(p.y)}`).join(""))
    .join("");
}

const NUDGES: Record<string, [keyof Rotation, 1 | -1]> = {
  ArrowLeft: ["rotateY", -1],
  ArrowRight: ["rotateY", 1],
  ArrowUp: ["rotateX", -1],
  ArrowDown: ["rotateX", 1],
  BracketLeft: ["rotateZ", -1],
  BracketRight: ["rotateZ", 1],
};

export type Vec3 = readonly [number, number, number];
/** Row-major 3×3 matrix. */
export type Mat3 = readonly [Vec3, Vec3, Vec3];
export type Rotation = { rotateX: number; rotateY: number; rotateZ: number };
export type Point = { x: number; y: number };
export type ProjectedPoint = Point & { depth: number };
/** A sphere drawn in SVG space: centre and radius in viewBox units. */
export type SphereFrame = { cx: number; cy: number; r: number };
/** A circle on the unit sphere, in device space: `centre + cos(t)·u + sin(t)·v`. */
export type SphereCircle = { centre: Vec3; u: Vec3; v: Vec3 };
export type DragZone = "sphere" | "ring";

/** The sphere is drawn as seen from slightly above, so the equator reads as an ellipse at rest. */
export const VIEW_PITCH = 18;

/** The device rotation the stage applies, Ry·Rx·Rz: Y > 0 turns the face right, X > 0 down, Z > 0 counter-clockwise. */
export function rotationMatrix({ rotateX, rotateY, rotateZ }: Rotation): Mat3 {
  return multiply(ry(rotateY), multiply(rx(rotateX), rz(rotateZ)));
}

/** Device space to the sphere's view space (y up, +z towards the viewer). */
export function viewMatrix(rotation: Rotation): Mat3 {
  return multiply(rx(VIEW_PITCH), rotationMatrix(rotation));
}

export function transform(m: Mat3, [x, y, z]: Vec3): Vec3 {
  return [
    m[0][0] * x + m[0][1] * y + m[0][2] * z,
    m[1][0] * x + m[1][1] * y + m[1][2] * z,
    m[2][0] * x + m[2][1] * y + m[2][2] * z,
  ];
}

/** Orthographic projection into SVG space (y down); `depth` > 0 faces the viewer. */
export function projectPoint(m: Mat3, point: Vec3, frame: SphereFrame): ProjectedPoint {
  const [x, y, z] = transform(m, point);
  return { x: frame.cx + x * frame.r, y: frame.cy - y * frame.r, depth: z };
}

/** The meridian whose front crosses the equator `longitude` degrees right of the face. */
export function meridian(longitude: number): SphereCircle {
  return greatCircle([Math.sin(longitude * DEG), 0, Math.cos(longitude * DEG)], [0, 1, 0]);
}

export const EQUATOR: SphereCircle = greatCircle([1, 0, 0], [0, 0, 1]);
export const PRIME_MERIDIAN: SphereCircle = meridian(0);
export const POLE: Vec3 = [0, 1, 0];
export const FACE: Vec3 = [0, 0, 1];

/** Projects a circle as two SVG paths, split where it crosses the silhouette. */
export function circlePaths(
  circle: SphereCircle,
  m: Mat3,
  frame: SphereFrame,
  segments = 120
): { front: string; back: string } {
  const at = (t: number): Vec3 => [
    circle.centre[0] + Math.cos(t) * circle.u[0] + Math.sin(t) * circle.v[0],
    circle.centre[1] + Math.cos(t) * circle.u[1] + Math.sin(t) * circle.v[1],
    circle.centre[2] + Math.cos(t) * circle.u[2] + Math.sin(t) * circle.v[2],
  ];
  const front: Point[][] = [];
  const back: Point[][] = [];
  let previous = projectPoint(m, at(0), frame);
  let run: Point[] = [previous];
  let facing = previous.depth >= 0;
  for (let i = 1; i <= segments; i++) {
    const next = projectPoint(m, at((i / segments) * 2 * Math.PI), frame);
    const nextFacing = next.depth >= 0;
    if (nextFacing !== facing) {
      const k = previous.depth / (previous.depth - next.depth);
      const crossing = {
        x: previous.x + (next.x - previous.x) * k,
        y: previous.y + (next.y - previous.y) * k,
      };
      run.push(crossing);
      (facing ? front : back).push(run);
      run = [crossing];
      facing = nextFacing;
    }
    run.push(next);
    previous = next;
  }
  (facing ? front : back).push(run);
  return { front: toPath(front), back: toPath(back) };
}

/** Wraps an angle into −180..180, keeping +180 rather than folding it to −180. */
export function wrapDegrees(value: number): number {
  if (value >= -180 && value <= 180) return value;
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

/** Rounds to the properties' 0.5° step, or to 15° while snapping, and wraps. */
export function quantizeDegrees(value: number, snap: boolean): number {
  const step = snap ? SNAP_STEP : FINE_STEP;
  return wrapDegrees(Math.round(value / step) * step) + 0;
}

/** Trackball drag: a pointer move of one radius turns the sphere by one radian. */
export function dragRotation(
  start: Pick<Rotation, "rotateX" | "rotateY">,
  delta: Point,
  radius: number,
  snap: boolean
): Pick<Rotation, "rotateX" | "rotateY"> {
  return {
    rotateX: quantizeDegrees(start.rotateX + delta.y / radius / DEG, snap),
    rotateY: quantizeDegrees(start.rotateY + delta.x / radius / DEG, snap),
  };
}

/** Counter-clockwise angle of `point` around the centre, in degrees, for SVG space (y down). */
export function ringAngle(point: Point, frame: Pick<SphereFrame, "cx" | "cy">): number {
  return Math.atan2(frame.cy - point.y, point.x - frame.cx) / DEG;
}

/** Roll follows the pointer around the ring: Z > 0 is counter-clockwise, like the stage. */
export function ringRotation(startZ: number, startAngle: number, angle: number, snap: boolean): number {
  return quantizeDegrees(startZ + wrapDegrees(angle - startAngle), snap);
}

/** Which control a pointer lands on: the sphere, the ring of width `ring` around it, or neither. */
export function dragZone(point: Point, frame: SphereFrame, ring: number): DragZone | null {
  const distance = Math.hypot(point.x - frame.cx, point.y - frame.cy);
  if (distance <= frame.r) return "sphere";
  if (distance <= frame.r + ring) return "ring";
  return null;
}

/** Arrow keys turn the face the way they point, by 1° (Shift 10°); [ and ] roll. Matched on `code` so Shift+[ still rolls. */
export function keyboardNudge(
  code: string,
  shift: boolean,
  rotation: Rotation
): { key: keyof Rotation; value: number } | null {
  const nudge = NUDGES[code];
  if (!nudge) return null;
  const [key, direction] = nudge;
  return { key, value: quantizeDegrees(rotation[key] + direction * (shift ? 10 : 1), false) };
}
