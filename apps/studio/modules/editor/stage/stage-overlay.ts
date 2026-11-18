import { blurGuideShapes } from "@calcom/product-video/stage/blur-guides";
import type { LayerGeometry } from "@calcom/product-video/stage/camera-projection";
import { type CanvasMode, dragTarget } from "@calcom/product-video/stage/canvas-drag";
import { deviceOutline } from "@calcom/product-video/stage/clip-picking";
import { depthOfFieldParams } from "@calcom/product-video/stage/depth-of-field";
import {
  type RotationGizmo,
  type RotationKey,
  rotationGizmo,
} from "@calcom/product-video/stage/rotation-gizmo";
import { resolveBlurSettings } from "@calcom/product-video/storyboard/blur-settings";
import {
  evaluateClipProperties,
  type PropertyValues,
} from "@calcom/product-video/storyboard/property-evaluation";
import type { Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { activeClipsAt } from "@calcom/product-video/storyboard/track-resolution";
import { drawBlurGuides } from "./blur-guides-drawing";
import { drawRotationGizmo } from "./rotation-gizmo-drawing";
import { drawLayerOutline } from "./selection-outline-drawing";
import type { FrameRect } from "./stage-picking";

const MAX_PIXEL_RATIO = 2;

export type StageOverlayState = {
  project: Project;
  selectedClipId: string | null;
  /** Exactly one clip is selected; the rotation gizmo needs one. */
  singleClipSelected: boolean;
  mode: CanvasMode;
  /** The Blur section is hovered or focused. */
  blurEditing: boolean;
  /** The gizmo ring hovered or dragged. */
  activeRing: RotationKey | null;
  frame: { width: number; height: number };
  /** The layer under the pointer, outlined while it isn't the selection. */
  hoveredClipId: string | null;
  /** The Select tool outlines the selected layer. */
  outlineSelection: boolean;
  /** Where a text layer is drawn; text is HTML, so the stage panel measures it. */
  textRect: (clipId: string) => FrameRect | null;
};

type LayerAt = (clipId: string) => LayerGeometry | null;

export type GizmoTarget = {
  clipId: string;
  values: PropertyValues;
  geometry: LayerGeometry;
  gizmo: RotationGizmo;
};

/** The rotation gizmo shows in Rotate mode on the one selected video clip, when the stage drew it. */
export function rotationGizmoTarget(
  state: StageOverlayState,
  time: number,
  layerAt: LayerAt
): GizmoTarget | null {
  if (state.mode !== "rotate" || !state.singleClipSelected) return null;
  const entry = activeClipsAt(state.project, time).find(
    (candidate) => candidate.clip.id === state.selectedClipId && candidate.clip.source.kind !== "text"
  );
  const geometry = entry ? layerAt(entry.clip.id) : null;
  if (!entry || !geometry) return null;
  const values = evaluateClipProperties(entry.clip, entry.localTime);
  return { clipId: entry.clip.id, values, geometry, gizmo: rotationGizmo(geometry, values) };
}

function drawBlur(
  context: CanvasRenderingContext2D,
  state: StageOverlayState,
  time: number,
  layerAt: LayerAt
) {
  if (!state.blurEditing && state.mode !== "focus") return false;
  const entry = dragTarget(activeClipsAt(state.project, time), state.selectedClipId);
  const geometry = entry ? layerAt(entry.clip.id) : null;
  const settings = entry ? resolveBlurSettings(entry.clip) : null;
  if (!entry || !geometry || !settings?.enabled) return false;
  const values = evaluateClipProperties(entry.clip, entry.localTime);
  const params = depthOfFieldParams(settings, values, geometry);
  drawBlurGuides(
    context,
    blurGuideShapes(settings, params, geometry, [values.focusX, values.focusY]),
    state.frame
  );
  return true;
}

function drawOutlines(
  context: CanvasRenderingContext2D,
  state: StageOverlayState,
  time: number,
  layerAt: LayerAt
): boolean {
  const active = new Set(activeClipsAt(state.project, time).map((entry) => entry.clip.id));
  const outlines: Array<[string | null, "selected" | "hovered"]> = [
    [state.outlineSelection ? state.selectedClipId : null, "selected"],
    [state.hoveredClipId !== state.selectedClipId ? state.hoveredClipId : null, "hovered"],
  ];
  let drew = false;
  for (const [clipId, style] of outlines) {
    if (!clipId || !active.has(clipId)) continue;
    const geometry = layerAt(clipId);
    const shape = geometry ? deviceOutline(geometry) : state.textRect(clipId);
    if (!shape) continue;
    drawLayerOutline(context, shape, style);
    drew = true;
  }
  return drew;
}

/**
 * Editing guides over the stage (blur guides, the rotation gizmo), on their own canvas so no composite or
 * export ever contains them. Cleared during playback; otherwise the canvas fades (CSS) in and out.
 */
export function drawStageOverlay(
  canvas: HTMLCanvasElement,
  layerAt: LayerAt,
  state: StageOverlayState,
  time: number,
  playing: boolean
): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const { frame } = state;
  const ratio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
  const [width, height] = [Math.round(frame.width * ratio), Math.round(frame.height * ratio)];
  if (canvas.width !== width || canvas.height !== height) [canvas.width, canvas.height] = [width, height];
  if (playing) {
    canvas.style.opacity = "0";
    context.clearRect(0, 0, width, height);
    return;
  }
  const gizmo = rotationGizmoTarget(state, time, layerAt);
  const wantsBlur = state.blurEditing || state.mode === "focus";
  const wantsOutline = state.outlineSelection || state.hoveredClipId !== null;
  if (!gizmo && !wantsBlur && !wantsOutline) {
    canvas.style.opacity = "0";
    return;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, frame.width, frame.height);
  const drewBlur = drawBlur(context, state, time, layerAt);
  const drewOutline = drawOutlines(context, state, time, layerAt);
  if (gizmo) drawRotationGizmo(context, gizmo.gizmo, state.activeRing, frame);
  canvas.style.opacity = gizmo || drewBlur || drewOutline ? "1" : "0";
}
