import { cameraRig, deviceWorldSize, layerPlacement } from "@calcom/product-video/stage/camera-rig";
import { type ClipLayer, resolveClipLayers } from "@calcom/product-video/stage/clip-layers";
import { devicePose } from "@calcom/product-video/stage/device-pose";
import type { Clip, Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { activeClipsAt } from "@calcom/product-video/storyboard/track-resolution";
import { WebGLRenderer } from "three";
import { type ClipView, createClipView } from "./clip-view";
import { createDepthOfField, type DepthOfField } from "./depth-of-field";
import { createFrameSourcePool } from "./frame-sources/frame-source-pool";
import { createStageBackground } from "./stage-background";
import { STAGE_COPY } from "./stage-copy";

export type StageRenderer = {
  setProject: (project: Project) => void;
  setSize: (width: number, height: number, pixelRatio: number) => void;
  /** Draws the composition at `time`; `playing` lets video sources run instead of seeking. */
  render: (time: number, playing: boolean) => void;
  dispose: () => void;
};

/** Seconds into the source file for import footage; recordings are numbered from the clip's start. */
function sourceTime(clip: Clip, localTime: number): number {
  return clip.source.kind === "import" ? clip.source.trimStart + localTime : localTime;
}

/**
 * The three.js half of the composition: background, then each visible clip with its own camera,
 * bottom track first, and depth of field when the topmost clip asks for it. Renders only when asked.
 */
export function createStageRenderer({
  canvas,
  onInvalidate,
}: {
  canvas: HTMLCanvasElement;
  /** A frame source has a new frame to show while paused. */
  onInvalidate: () => void;
}): StageRenderer {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.autoClear = false;
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  const background = createStageBackground(renderer);

  let project: Project | null = null;
  let frame = { width: 1, height: 1 };
  let pixelRatio = 1;
  let layers: ClipLayer[] = [];
  const views = new Map<string, ClipView>();
  const sources = createFrameSourcePool({
    maxAnisotropy,
    placeholderLabel: STAGE_COPY.notRecorded,
    onFrame: onInvalidate,
  });
  let depthOfField: DepthOfField | null = null;
  let disposed = false;

  const drawComposite = () => {
    background.draw();
    for (const layer of layers) {
      const view = views.get(layer.active.clip.id);
      if (!view) continue;
      renderer.clearDepth();
      renderer.render(view.scene, view.camera);
    }
  };

  const ensureDepthOfField = () => {
    if (depthOfField) return depthOfField;
    depthOfField = createDepthOfField(renderer, drawComposite);
    depthOfField.setSize(frame.width, frame.height, pixelRatio);
    return depthOfField;
  };

  return {
    setProject(next) {
      project = next;
      sources.sync(next);
      const live = new Set(next.videoTracks.flatMap((track) => track.clips.map((clip) => clip.id)));
      for (const [clipId, view] of views) {
        if (live.has(clipId)) continue;
        view.dispose();
        views.delete(clipId);
      }
      background.update(next.settings.background, frame);
    },
    setSize(width, height, ratio) {
      frame = { width: Math.max(1, width), height: Math.max(1, height) };
      pixelRatio = ratio;
      renderer.setPixelRatio(ratio);
      renderer.setSize(frame.width, frame.height, false);
      depthOfField?.setSize(frame.width, frame.height, ratio);
      if (project) background.update(project.settings.background, frame);
    },
    render(time, playing) {
      if (!project || disposed) return;
      layers = resolveClipLayers(activeClipsAt(project, time));
      sources.idleExcept(new Set(layers.map((layer) => layer.active.clip.id)));

      for (const layer of layers) {
        const clip = layer.active.clip;
        const source = sources.get(clip.id);
        if (!source) continue;
        source.show(sourceTime(clip, layer.active.localTime), playing);
        let view = views.get(clip.id);
        if (!view) {
          view = createClipView();
          views.set(clip.id, view);
        }
        const device = deviceWorldSize(source.size);
        view.update({
          rig: cameraRig(layer.view, device, frame),
          pose: devicePose(layer.view, device),
          placement: layerPlacement(layer),
          frame,
          device,
          texture: source.texture,
          opacity: layer.opacity,
          blur: layer.blur,
          settings: project.settings,
        });
      }

      const focused = layers.findLast((layer) => layer.view.blur > 0);
      const focusedView = focused ? views.get(focused.active.clip.id) : undefined;
      if (!focused || !focusedView) {
        renderer.setRenderTarget(null);
        drawComposite();
        return;
      }
      ensureDepthOfField().render(focusedView, focused.view.blur);
    },
    dispose() {
      disposed = true;
      sources.dispose();
      for (const view of views.values()) view.dispose();
      views.clear();
      depthOfField?.dispose();
      background.dispose();
      renderer.dispose();
    },
  };
}
