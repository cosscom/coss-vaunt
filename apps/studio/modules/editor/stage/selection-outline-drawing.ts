import type { FrameRect } from "./stage-picking";

/** The theme's info blue (blue-500), as the rotation gizmo's Z ring and blur guides use. */
const OUTLINE = "rgb(59 130 246)";

/** A layer's outline: solid for the selection, dashed for the layer under the pointer. */
export function drawLayerOutline(
  context: CanvasRenderingContext2D,
  shape: Array<[number, number]> | FrameRect,
  style: "selected" | "hovered"
): void {
  context.save();
  context.strokeStyle = OUTLINE;
  context.lineWidth = 1.5;
  context.setLineDash(style === "hovered" ? [5, 4] : []);
  context.beginPath();
  if (Array.isArray(shape)) {
    shape.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
    context.closePath();
  } else {
    context.rect(shape.x, shape.y, shape.width, shape.height);
  }
  context.stroke();
  context.restore();
}
