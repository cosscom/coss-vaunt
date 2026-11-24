import type { Point, RotationGizmo, RotationKey } from "@coss/vaunt-engine/stage/rotation-gizmo";

const AXIS_COLOUR: Record<RotationKey, string> = {
  rotateX: "rgb(239 68 68)",
  rotateY: "rgb(34 197 94)",
  rotateZ: "rgb(59 130 246)",
};
const BACK_ALPHA = 0.35;

function arrow(context: CanvasRenderingContext2D, from: Point, to: Point, colour: string): void {
  context.strokeStyle = colour;
  context.fillStyle = colour;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(...from);
  context.lineTo(...to);
  context.stroke();
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  context.beginPath();
  context.moveTo(...to);
  for (const side of [-1, 1]) {
    context.lineTo(to[0] - 9 * Math.cos(angle + side * 0.4), to[1] - 9 * Math.sin(angle + side * 0.4));
  }
  context.closePath();
  context.fill();
}

/** `active` is the ring hovered or dragged: drawn thicker, with its axis as a line through the pivot. */
export function drawRotationGizmo(
  context: CanvasRenderingContext2D,
  gizmo: RotationGizmo,
  active: RotationKey | null,
  frame: { width: number; height: number }
): void {
  context.save();
  context.shadowColor = "rgb(0 0 0 / 0.45)";
  context.shadowBlur = 2;
  const ring = gizmo.rings.find((candidate) => candidate.key === active);
  if (ring && Math.hypot(...ring.axis) > 1e-3) {
    const reach = Math.hypot(frame.width, frame.height) / Math.hypot(...ring.axis);
    context.strokeStyle = "rgb(255 255 255 / 0.8)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(gizmo.pivot[0] - ring.axis[0] * reach, gizmo.pivot[1] - ring.axis[1] * reach);
    context.lineTo(gizmo.pivot[0] + ring.axis[0] * reach, gizmo.pivot[1] + ring.axis[1] * reach);
    context.stroke();
  }
  for (const { key, points, front } of gizmo.rings) {
    context.strokeStyle = AXIS_COLOUR[key];
    context.lineWidth = key === active ? 3.5 : 2;
    for (let index = 1; index < points.length; index++) {
      context.globalAlpha = front[index] || key === active ? 1 : BACK_ALPHA;
      context.beginPath();
      context.moveTo(...points[index - 1]);
      context.lineTo(...points[index]);
      context.stroke();
    }
  }
  context.globalAlpha = 1;
  arrow(context, gizmo.pivot, gizmo.arrows.z, "rgb(255 255 255)");
  arrow(context, gizmo.pivot, gizmo.arrows.x, AXIS_COLOUR.rotateX);
  arrow(context, gizmo.pivot, gizmo.arrows.y, AXIS_COLOUR.rotateY);
  context.fillStyle = "white";
  context.beginPath();
  context.arc(...gizmo.pivot, 4, 0, Math.PI * 2);
  context.fill();
  context.restore();
}
