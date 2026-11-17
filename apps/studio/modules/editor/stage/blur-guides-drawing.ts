import type { BlurGuideShapes, Point } from "@calcom/product-video/stage/blur-guides";

const GUIDE = "rgb(255 140 26)";
const SHADE = (alpha: number) => `rgb(255 140 26 / ${alpha})`;
/** Shade at full blur; the content under it must stay readable. */
const MAX_SHADE = 0.3;
const GIZMO_RADIUS = 8;

function path(context: CanvasRenderingContext2D, points: Point[]): void {
  context.beginPath();
  for (const [x, y] of points) context.lineTo(x, y);
  context.closePath();
}

function line(context: CanvasRenderingContext2D, [from, to]: [Point, Point]): void {
  context.beginPath();
  context.moveTo(...from);
  context.lineTo(...to);
  context.stroke();
}

function arrowHead(context: CanvasRenderingContext2D, [from, to]: [Point, Point]): void {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  for (const side of [-1, 1]) {
    line(context, [
      to,
      [to[0] - 10 * Math.cos(angle + side * 0.5), to[1] - 10 * Math.sin(angle + side * 0.5)],
    ]);
  }
}

function drawFalloff(
  context: CanvasRenderingContext2D,
  shapes: BlurGuideShapes,
  width: number,
  height: number
) {
  const falloff = shapes.falloff;
  if (!falloff) return;
  const { centre, inner, outer, direction } = falloff;
  const span = Math.max(1, outer);
  if (falloff.shape === "circle") {
    const gradient = context.createRadialGradient(...centre, 0, ...centre, span);
    gradient.addColorStop(0, SHADE(0));
    gradient.addColorStop(Math.min(1, inner / span), SHADE(0));
    gradient.addColorStop(1, SHADE(MAX_SHADE));
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.setLineDash([4, 4]);
    context.beginPath();
    context.arc(...centre, inner, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    return;
  }
  const normal: Point = [-direction[1], direction[0]];
  const at = (distance: number): Point => [
    centre[0] + normal[0] * distance,
    centre[1] + normal[1] * distance,
  ];
  const gradient = context.createLinearGradient(...at(-span), ...at(span));
  const edge = Math.min(0.5, inner / (2 * span));
  gradient.addColorStop(0, SHADE(MAX_SHADE));
  gradient.addColorStop(0.5 - edge, SHADE(0));
  gradient.addColorStop(0.5 + edge, SHADE(0));
  gradient.addColorStop(1, SHADE(MAX_SHADE));
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  const reach = Math.hypot(width, height);
  const across = (offset: number): [Point, Point] => {
    const [x, y] = at(offset);
    return [
      [x - direction[0] * reach, y - direction[1] * reach],
      [x + direction[0] * reach, y + direction[1] * reach],
    ];
  };
  line(context, across(0));
  context.setLineDash([4, 4]);
  line(context, across(-inner));
  line(context, across(inner));
  context.setLineDash([]);
}

/** Guides are drawn in frame CSS px onto an overlay canvas that is never part of the composite. */
export function drawBlurGuides(
  context: CanvasRenderingContext2D,
  shapes: BlurGuideShapes,
  frame: { width: number; height: number }
): void {
  context.strokeStyle = GUIDE;
  context.lineWidth = 1.5;
  for (const cell of shapes.cells) {
    if (cell.amount <= 0) continue;
    context.fillStyle = SHADE(cell.amount * MAX_SHADE);
    path(context, cell.points);
    context.fill();
  }
  drawFalloff(context, shapes, frame.width, frame.height);
  path(context, shapes.outline);
  context.stroke();
  if (shapes.focusLine) {
    context.lineWidth = 2;
    line(context, shapes.focusLine);
    context.lineWidth = 1.5;
  }
  if (shapes.streak) {
    line(context, shapes.streak);
    arrowHead(context, shapes.streak);
    arrowHead(context, [shapes.streak[1], shapes.streak[0]]);
  }
  const point = shapes.focusPoint;
  if (!point) return;
  context.beginPath();
  context.arc(...point, GIZMO_RADIUS, 0, Math.PI * 2);
  context.stroke();
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    line(context, [
      [point[0] + dx * GIZMO_RADIUS * 0.5, point[1] + dy * GIZMO_RADIUS * 0.5],
      [point[0] + dx * GIZMO_RADIUS * 1.6, point[1] + dy * GIZMO_RADIUS * 1.6],
    ]);
  }
  context.fillStyle = "white";
  context.beginPath();
  context.arc(...point, 2, 0, Math.PI * 2);
  context.fill();
}
