import { Camera, Scene, Vector3, type WebGLRenderer, type WebGLRenderTarget } from "three";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import type { ClipView } from "./clip-view";

/** At blur 1: the blur radius cap (frame fractions) and how fast it grows away from the focus. */
const MAX_BOKEH = 0.025;
const BOKEH_APERTURE = 0.08;

/** Draws into whatever target the composer hands it, so the composite can feed the bokeh pass. */
class CompositePass extends Pass {
  constructor(private readonly draw: () => void) {
    super();
    this.needsSwap = false;
  }

  override render(
    renderer: WebGLRenderer,
    _writeBuffer: WebGLRenderTarget,
    readBuffer: WebGLRenderTarget
  ): void {
    renderer.setRenderTarget(readBuffer);
    this.draw();
  }
}

export type DepthOfField = {
  /** Draws the composite through three's BokehPass, using `view`'s depth and focused at its device. */
  render: (view: ClipView, blur: number) => void;
  setSize: (width: number, height: number, pixelRatio: number) => void;
  dispose: () => void;
};

export function createDepthOfField(renderer: WebGLRenderer, drawComposite: () => void): DepthOfField {
  const composer = new EffectComposer(renderer);
  const bokeh = new BokehPass(new Scene(), new Camera(), { focus: 1, aperture: 0, maxblur: 0 });
  composer.addPass(new CompositePass(drawComposite));
  composer.addPass(bokeh);
  composer.addPass(new OutputPass());
  const focusPoint = new Vector3();

  return {
    render(view, blur) {
      bokeh.scene = view.scene;
      bokeh.camera = view.camera;
      view.camera.updateMatrixWorld();
      const uniforms = bokeh.materialBokeh.uniforms;
      uniforms.focus.value = -focusPoint.set(0, 0, 0).applyMatrix4(view.camera.matrixWorldInverse).z;
      uniforms.aperture.value = BOKEH_APERTURE * blur;
      uniforms.maxblur.value = MAX_BOKEH * blur;
      composer.render();
    },
    setSize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    dispose() {
      bokeh.dispose();
      composer.dispose();
    },
  };
}
