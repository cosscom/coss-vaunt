import type { ProjectSettings } from "@calcom/product-video/storyboard/storyboard-schema";
import { Camera, Color, Scene, type Texture, type WebGLRenderer } from "three";
import { createGradientTexture } from "./stage-textures";

const MAX_GRADIENT_PX = 1024;

export type StageBackground = {
  update: (background: ProjectSettings["background"], frame: { width: number; height: number }) => void;
  /** Clears the current target to the background. */
  draw: () => void;
  dispose: () => void;
};

/** A colour clears the frame; a gradient is painted once per change and drawn as the scene background. */
export function createStageBackground(renderer: WebGLRenderer): StageBackground {
  const scene = new Scene();
  const camera = new Camera();
  const color = new Color();
  let texture: Texture | null = null;
  let key = "";

  return {
    update(background, frame) {
      const next = `${background.kind}:${background.value}:${frame.width}x${frame.height}`;
      if (next === key) return;
      key = next;
      texture?.dispose();
      texture = null;
      if (background.kind === "gradient") {
        const scale = Math.min(1, MAX_GRADIENT_PX / Math.max(frame.width, frame.height));
        texture = createGradientTexture(background.value, frame.width * scale, frame.height * scale);
      }
      scene.background = texture;
      if (!texture) color.set(background.kind === "color" ? background.value : "#000");
    },
    draw() {
      renderer.setClearColor(texture ? 0x000000 : color, 1);
      renderer.clear();
      if (texture) renderer.render(scene, camera);
    },
    dispose() {
      texture?.dispose();
    },
  };
}
