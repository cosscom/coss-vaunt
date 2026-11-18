import { type LayerGeometry, layerGeometry } from "@calcom/product-video/stage/camera-projection";
import { deviceWorldSize } from "@calcom/product-video/stage/camera-rig";
import { type ClipLayer, resolveClipLayers } from "@calcom/product-video/stage/clip-layers";
import type { CursorSource } from "@calcom/product-video/stage/cursor-focus";
import { cursorPlaneLayout } from "@calcom/product-video/stage/cursor-plane-layout";
import { cursorFrameAt } from "@calcom/product-video/stage/cursor-track";
import { depthOfFieldParams } from "@calcom/product-video/stage/depth-of-field";
import { resolveBlurSettings } from "@calcom/product-video/storyboard/blur-settings";
import { resolveCursorSettings } from "@calcom/product-video/storyboard/cursor-settings";
import type { Clip, Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { activeClipsAt } from "@calcom/product-video/storyboard/track-resolution";
import { WebGLRenderer } from "three";
import { type ClipView, type ClipViewInput, createClipView } from "./clip-view";
import { createCursorTracks } from "./cursor-tracks";
import { createDepthOfField, type DepthOfField } from "./depth-of-field";
import { createFrameSourcePool } from "./frame-sources/frame-source-pool";
import { createStageBackground } from "./stage-background";
import { STAGE_COPY } from "./stage-copy";

export type StageRenderer = {
  setProject: (project: Project) => void;
  /** Reloads every clip's media: recordings, imports, images and cursor paths. */
  refreshMedia: () => void;
  setSize: (width: number, height: number, pixelRatio: number) => void;
  /** Export: loads every visible clip's media for `time` at full quality; draw with `render(time, false)` once it resolves. */
  prepare: (time: number) => Promise<void>;
  /** Draws the composition at `time`; `playing` lets video sources run instead of seeking. */
  render: (time: number, playing: boolean) => void;
  /** A recording clip's cursor path, once loaded, for guides that follow it. */
  cursorFor: (clipId: string) => CursorSource | null;
  /** Where a clip drawn by the last render sits, for overlays and canvas tools; null when it wasn't drawn. */
  layerGeometry: (clipId: string) => LayerGeometry | null;
  dispose: () => void;
};

/** Seconds into the source file for import footage; recordings are numbered from the clip's start. */
function sourceTime(clip: Clip, localTime: number): number {
  return clip.source.kind === "import" ? clip.source.trimStart + localTime : localTime;
}

/**
 * The three.js half of the composition: background, then each visible clip with its own camera,
 * bottom track first, and depth of field from the topmost clip that has it on. Renders only when asked.
 */
export function createStageRenderer({
  canvas,
  onInvalidate,
  forExport = false,
}: {
  canvas: HTMLCanvasElement;
  /** A frame source has a new frame to show while paused. */
  onInvalidate: () => void;
  /** Rendering an export: keeps each drawn frame for the screenshot and never swaps sources mid-render. */
  forExport?: boolean;
}): StageRenderer {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: forExport,
  });
  renderer.autoClear = false;
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  const background = createStageBackground(renderer);

  let project: Project | null = null;
  let frame = { width: 1, height: 1 };
  let pixelRatio = 1;
  let layers: ClipLayer[] = [];
  const geometries = new Map<string, LayerGeometry>();
  const views = new Map<string, ClipView>();
  const sources = createFrameSourcePool({
    maxAnisotropy,
    placeholderLabel: STAGE_COPY.notRecorded,
    onFrame: onInvalidate,
    upgrade: !forExport,
  });
  const cursorTracks = createCursorTracks({ onLoad: onInvalidate });
  let depthOfField: DepthOfField | null = null;
  let disposed = false;

  const cursorFor = (clip: Clip, localTime: number): ClipViewInput["cursor"] => {
    const settings = resolveCursorSettings(clip);
    const loaded = settings?.visible ? cursorTracks.get(clip.id) : null;
    const pointer = loaded && cursorFrameAt(loaded.track, localTime);
    if (!settings || !loaded || !pointer) return null;
    return { layout: cursorPlaneLayout(pointer, settings, loaded.viewport), style: settings.style };
  };

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
      cursorTracks.sync(next);
      const live = new Set(next.videoTracks.flatMap((track) => track.clips.map((clip) => clip.id)));
      for (const [clipId, view] of views) {
        if (live.has(clipId)) continue;
        view.dispose();
        views.delete(clipId);
      }
      background.update(next.settings.background, frame);
    },
    cursorFor: (clipId) => cursorTracks.get(clipId),
    async prepare(time) {
      if (!project) return;
      const videos = activeClipsAt(project, time).filter((entry) => entry.clip.source.kind !== "text");
      await Promise.all(
        videos.flatMap(({ clip, localTime }) => [
          sources.prepare(clip.id, sourceTime(clip, localTime)),
          cursorTracks.prepare(clip.id),
        ])
      );
    },
    refreshMedia() {
      if (!project) return;
      sources.refresh(project);
      cursorTracks.refresh(project);
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
      layers = resolveClipLayers(activeClipsAt(project, time), {
        frame,
        deviceFor: (clipId) => {
          const size = sources.get(clipId)?.size;
          return size ? deviceWorldSize(size) : null;
        },
        cursorFor: (clipId) => cursorTracks.get(clipId),
      });
      sources.idleExcept(new Set(layers.map((layer) => layer.active.clip.id)));
      geometries.clear();

      for (const layer of layers) {
        const clip = layer.active.clip;
        const source = sources.get(clip.id);
        if (!source) continue;
        source.show(sourceTime(clip, layer.active.localTime), playing);
        let view = views.get(clip.id);
        if (!view) {
          view = createClipView({ maxAnisotropy });
          views.set(clip.id, view);
        }
        const geometry = layerGeometry(layer.view, layer, deviceWorldSize(source.size), frame);
        geometries.set(clip.id, geometry);
        view.update({
          ...geometry,
          texture: source.texture,
          opacity: layer.opacity,
          blur: layer.blur,
          settings: project.settings,
          cursor: cursorFor(clip, layer.active.localTime),
        });
      }

      const focused = layers.findLast(
        (layer) => layer.view.blur > 0 && resolveBlurSettings(layer.active.clip).enabled
      );
      const focusedView = focused ? views.get(focused.active.clip.id) : undefined;
      const focusedGeometry = focused ? geometries.get(focused.active.clip.id) : undefined;
      if (!focused || !focusedView || !focusedGeometry) {
        renderer.setRenderTarget(null);
        drawComposite();
        return;
      }
      ensureDepthOfField().render(
        focusedView,
        depthOfFieldParams(resolveBlurSettings(focused.active.clip), focused.view, focusedGeometry)
      );
    },
    layerGeometry: (clipId) => geometries.get(clipId) ?? null,
    dispose() {
      disposed = true;
      sources.dispose();
      cursorTracks.dispose();
      for (const view of views.values()) view.dispose();
      views.clear();
      depthOfField?.dispose();
      background.dispose();
      renderer.dispose();
    },
  };
}
