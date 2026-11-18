import { CanvasTexture, SRGBColorSpace } from "three";
import type { FrameSource } from "./frame-source";

/** The desktop viewport recordings default to, until a manifest says otherwise. */
const PLACEHOLDER_SIZE = { width: 1440, height: 900 };

/** A neutral plane for a recording clip that hasn't been recorded yet. */
export function createPlaceholderFrameSource({
  theme,
  label,
}: {
  theme: "light" | "dark";
  label: string;
}): FrameSource {
  const canvas = document.createElement("canvas");
  canvas.width = PLACEHOLDER_SIZE.width / 2;
  canvas.height = PLACEHOLDER_SIZE.height / 2;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = theme === "dark" ? "#1c1c1f" : "#f4f4f5";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = theme === "dark" ? "#71717a" : "#a1a1aa";
    context.font = "500 28px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, canvas.width / 2, canvas.height / 2);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return {
    texture,
    size: PLACEHOLDER_SIZE,
    show: () => undefined,
    prepare: () => Promise.resolve(),
    idle: () => undefined,
    dispose: () => texture.dispose(),
  };
}
