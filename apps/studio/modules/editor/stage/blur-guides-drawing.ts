import type { BlurGuideShapes, Point } from "@coss/vaunt-engine/stage/blur-guides";

/** The theme's info blue (blue-500), as the rotation gizmo's Z ring uses. */
const GUIDE = "rgb(59 130 246)";
const SHADE = (alpha: number) => `rgb(59 130 246 / ${alpha})`;
/** Shade at full blur; the content under it must stay readable. */
const MAX_SHADE = 0.3;
const GIZMO_RADIUS = 8;
/** The dot to drag to turn the blur's angle. */
const HANDLE_RADIUS = 4.5;

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

/** The sharp area's edge, dashed, as it lies on the device; tilt shift's centre line solid. */
function drawFalloff(context: CanvasRenderingContext2D, shapes: BlurGuideShapes) {
  const falloff = shapes.falloff;
  if (!falloff) return;
  if (falloff.centreLine) line(context, falloff.centreLine);
  context.setLineDash([4, 4]);
  for (const edge of falloff.edges) {
    if (falloff.shape === "circle") {
      path(context, edge);
      context.stroke();
    } else if (edge.length === 2) {
      line(context, [edge[0], edge[1]] as [Point, Point]);
    }
  }
  context.setLineDash([]);
}

/** Guides are drawn in frame CSS px onto an overlay canvas that is never part of the composite. */
export function drawBlurGuides(context: CanvasRenderingContext2D, shapes: BlurGuideShapes): void {
  context.strokeStyle = GUIDE;
  context.lineWidth = 1.5;
  for (const cell of shapes.cells) {
    if (cell.amount <= 0) continue;
    context.fillStyle = SHADE(cell.amount * MAX_SHADE);
    path(context, cell.points);
    context.fill();
  }
  drawFalloff(context, shapes);
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
  if (shapes.angleHandle) {
    context.fillStyle = GUIDE;
    context.beginPath();
    context.arc(...shapes.angleHandle, HANDLE_RADIUS, 0, Math.PI * 2);
    context.fill();
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
