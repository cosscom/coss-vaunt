export type GradientStop = { color: string; offset: number };

export type BackgroundGradient =
  | { kind: "linear"; angle: number; stops: GradientStop[] }
  /** Radii and centre are fractions of the frame's width and height. */
  | {
      kind: "radial";
      radiusX: number;
      radiusY: number;
      centerX: number;
      centerY: number;
      stops: GradientStop[];
    };

/** Splits on commas outside parentheses, so `rgb(1, 2, 3)` stays one part. */
function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parsePercent(value: string | undefined, fallback: number): number {
  if (value === undefined || !value.endsWith("%")) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed / 100 : fallback;
}

function parseStops(parts: string[]): GradientStop[] | null {
  if (parts.length < 2) return null;
  const stops = parts.map((part, index) => {
    const match = /^(.*?)(?:\s+(-?[\d.]+%))?$/.exec(part);
    const color = match?.[1]?.trim() ?? part;
    return { color, offset: parsePercent(match?.[2], index / (parts.length - 1)) };
  });
  return stops.every((stop) => stop.color.length > 0) ? stops : null;
}

/**
 * Parses the CSS gradients the background swatches use: `linear-gradient(<angle>deg, stops…)` and
 * `radial-gradient(<rx>% <ry>% at <cx>% <cy>%, stops…)`, with stops as `<color> [<percent>]`.
 */
export function parseBackgroundGradient(css: string): BackgroundGradient | null {
  const match = /^\s*(linear|radial)-gradient\(([\s\S]*)\)\s*$/.exec(css);
  if (!match) return null;
  const [, kind, body] = match;
  const parts = splitTopLevel(body ?? "");
  const [first = "", ...rest] = parts;

  if (kind === "linear") {
    const angle = /^(-?[\d.]+)deg$/.exec(first);
    const stops = parseStops(angle ? rest : parts);
    return stops
      ? { kind: "linear", angle: angle ? Number.parseFloat(angle[1] ?? "180") : 180, stops }
      : null;
  }

  const shape = /^(?:([\d.]+%)\s+([\d.]+%))?\s*(?:at\s+([\d.]+%)\s+([\d.]+%))?$/.exec(first);
  const hasShape = shape !== null && first.length > 0;
  const stops = parseStops(hasShape ? rest : parts);
  if (!stops) return null;
  return {
    kind: "radial",
    radiusX: parsePercent(shape?.[1], 0.5),
    radiusY: parsePercent(shape?.[2], 0.5),
    centerX: parsePercent(shape?.[3], 0.5),
    centerY: parsePercent(shape?.[4], 0.5),
    stops,
  };
}

/** Start and end of a CSS linear gradient line in a `width` × `height` box, as CSS lays it out. */
export function linearGradientLine(
  angle: number,
  width: number,
  height: number
): { x0: number; y0: number; x1: number; y1: number } {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  const cx = width / 2;
  const cy = height / 2;
  return { x0: cx - dx * half, y0: cy - dy * half, x1: cx + dx * half, y1: cy + dy * half };
}
