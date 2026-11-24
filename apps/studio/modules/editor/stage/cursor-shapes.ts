import { CURSOR_SHAPES } from "@coss/vaunt-engine/stage/cursor-plane-layout";
import type { CursorStyle } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from "three";

/** Far more texels per page pixel than the recording itself has, so the cursor stays sharp under zoom. */
const TEXTURE_SIZE = 512;

/** The macOS arrow in page pixels from its tip. */
const ARROW: ReadonlyArray<[number, number]> = [
  [0, 0],
  [0, 17],
  [4, 13.2],
  [6.8, 19.5],
  [9.4, 18.4],
  [6.7, 12.2],
  [12, 12.2],
];

function drawArrow(context: CanvasRenderingContext2D): void {
  context.beginPath();
  for (const [x, y] of ARROW) context.lineTo(x, y);
  context.closePath();
  context.lineJoin = "round";
  context.lineWidth = 1.5;
  context.strokeStyle = "#000";
  context.stroke();
  context.shadowColor = "transparent";
  context.fillStyle = "#fff";
  context.fill();
}

function drawDot(context: CanvasRenderingContext2D): void {
  context.beginPath();
  context.arc(0, 0, 7, 0, Math.PI * 2);
  context.fillStyle = "rgba(17, 17, 17, 0.6)";
  context.fill();
  context.shadowColor = "transparent";
  context.lineWidth = 1.5;
  context.strokeStyle = "#fff";
  context.stroke();
}

export function createCursorTexture(style: CursorStyle, maxAnisotropy: number): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const context = canvas.getContext("2d");
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = maxAnisotropy;
  if (!context) return texture;

  const { hotspot, side } = CURSOR_SHAPES[style];
  const scale = TEXTURE_SIZE / side;
  context.setTransform(scale, 0, 0, scale, hotspot.u * TEXTURE_SIZE, hotspot.v * TEXTURE_SIZE);
  context.shadowColor = "rgba(0, 0, 0, 0.35)";
  context.shadowBlur = 3 * scale;
  context.shadowOffsetY = scale;
  if (style === "arrow") drawArrow(context);
  else drawDot(context);
  return texture;
}
