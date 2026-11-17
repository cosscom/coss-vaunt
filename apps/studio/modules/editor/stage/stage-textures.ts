import { linearGradientLine, parseBackgroundGradient } from "@calcom/product-video/stage/background-gradient";
import { CanvasTexture, SRGBColorSpace } from "three";

function canvasTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Paints a CSS background gradient at the frame's shape; null when the value isn't one we read. */
export function createGradientTexture(css: string, width: number, height: number): CanvasTexture | null {
  const gradient = parseBackgroundGradient(css);
  if (!gradient) return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context) return null;

  if (gradient.kind === "linear") {
    const { x0, y0, x1, y1 } = linearGradientLine(gradient.angle, canvas.width, canvas.height);
    const fill = context.createLinearGradient(x0, y0, x1, y1);
    for (const stop of gradient.stops) fill.addColorStop(Math.min(1, Math.max(0, stop.offset)), stop.color);
    context.fillStyle = fill;
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    const radiusX = gradient.radiusX * canvas.width;
    const radiusY = gradient.radiusY * canvas.height;
    const last = gradient.stops[gradient.stops.length - 1];
    context.fillStyle = last?.color ?? "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.translate(gradient.centerX * canvas.width, gradient.centerY * canvas.height);
    context.scale(1, radiusY / radiusX);
    const fill = context.createRadialGradient(0, 0, 0, 0, 0, radiusX);
    for (const stop of gradient.stops) fill.addColorStop(Math.min(1, Math.max(0, stop.offset)), stop.color);
    context.fillStyle = fill;
    context.fillRect(-canvas.width * 4, -canvas.height * 4, canvas.width * 8, canvas.height * 8);
    context.restore();
  }
  return canvasTexture(canvas);
}
