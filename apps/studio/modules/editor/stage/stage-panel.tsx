"use client";

import type { CanvasMode } from "@calcom/product-video/stage/canvas-drag";
import { aspectRatioSize, letterbox } from "@calcom/product-video/stage/frame-letterbox";
import type { PropertyKey } from "@calcom/product-video/storyboard/property-specs";
import type { Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { activeClipsAt } from "@calcom/product-video/storyboard/track-resolution";
import { Button } from "@coss/ui/components/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { BoxIcon, FocusIcon, HandIcon, MousePointer2Icon, RefreshCwIcon, RotateCwIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import { SegmentedRadio, SegmentedRadioGroup } from "@coss/ui/shared/segmented-radio-group";
import type * as React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type PlaybackClock, usePlaybackState } from "../player/playback-clock";
import { STAGE_COPY as copy } from "./stage-copy";
import {
  blurGuideTarget,
  drawStageOverlay,
  rotationGizmoTarget,
  type StageOverlayState,
} from "./stage-overlay";
import { clipAtPoint, textRectFor } from "./stage-picking";
import { createStageRenderer, type StageRenderer } from "./stage-renderer";
import { textColorForBackground } from "./text/text-contrast";
import { TextOverlay } from "./text-overlay";
import { useCanvasDrag } from "./use-canvas-drag";
import { useStageHover } from "./use-stage-hover";

export type StagePanelProps = {
  project: Project;
  clock: PlaybackClock;
  selectedClipId: string | null;
  /** Exactly one clip is selected, so Rotate mode shows the rotation gizmo on it. */
  singleClipSelected: boolean;
  /** The inspector's Blur section is being edited or a Blur lane is selected, so the stage shows blur guides. */
  blurEditing: boolean;
  /** Called by canvas drags (every canvas mode); the editor applies `setPropertyAt` at the playhead. */
  onSetProperty: (clipId: string, key: PropertyKey, value: number) => void;
  /** A layer picked on the stage, or null for a click on the background. */
  onSelectClip: (clipId: string | null, additive: boolean) => void;
};

type StageTool = "select" | CanvasMode;
const TOOLS: readonly StageTool[] = ["select", "camera", "orbit", "rotate", "focus"];

const FRAME_PADDING = 24;
const MAX_PIXEL_RATIO = 2;

function useElementSize(element: HTMLElement | null): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return size;
}

/** Re-renders with the clock, so it stays out of the panel: only the text overlay redraws per frame. */
function StageText({
  project,
  clock,
  frame,
}: Pick<StagePanelProps, "project" | "clock"> & { frame: { width: number; height: number } }) {
  const time = usePlaybackState(clock, (state) => state.time);
  const clips = activeClipsAt(project, time).filter((entry) => entry.clip.source.kind === "text");
  return <TextOverlay clips={clips} color={textColorForBackground(project.settings)} frame={frame} />;
}

export function StagePanel({
  project,
  clock,
  selectedClipId,
  singleClipSelected,
  blurEditing,
  onSetProperty,
  onSelectClip,
}: StagePanelProps): React.ReactElement {
  const [area, setArea] = useState<HTMLDivElement | null>(null);
  const [frameElement, setFrameElement] = useState<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const stage = useRef<{ renderer: StageRenderer; invalidate: () => void } | null>(null);
  const [tool, setTool] = useState<StageTool>("select");
  const mode: CanvasMode = tool === "select" ? "camera" : tool;
  const [failed, setFailed] = useState(false);

  const areaSize = useElementSize(area);
  const frame = useMemo(
    () => letterbox(areaSize, aspectRatioSize(project.settings.aspectRatio), FRAME_PADDING),
    [areaSize, project.settings.aspectRatio]
  );
  const latest = useRef<StageOverlayState>({
    project,
    frame,
    selectedClipId,
    singleClipSelected,
    mode,
    blurEditing,
    activeRing: null,
    hoveredClipId: null,
    outlineSelection: tool === "select",
    textRect: () => null,
    cursorFor: () => null,
  });
  const layerAt = (clipId: string) => stage.current?.renderer.layerGeometry(clipId) ?? null;
  const hasText = project.videoTracks.some((track) =>
    track.clips.some((clip) => clip.source.kind === "text")
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scheduled = false;
    let renderer: StageRenderer;
    const draw = () => {
      scheduled = false;
      const { time, playing } = clock.getState();
      renderer.render(time, playing);
      if (overlayRef.current) {
        drawStageOverlay(overlayRef.current, renderer.layerGeometry, latest.current, time, playing);
      }
    };
    // Coalesces clock ticks, edits and decoded frames into one draw per task.
    const invalidate = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(draw);
    };
    try {
      renderer = createStageRenderer({ canvas, onInvalidate: invalidate });
    } catch {
      setFailed(true);
      return;
    }
    stage.current = { renderer, invalidate };
    const { project: initialProject, frame: initialFrame } = latest.current;
    renderer.setProject(initialProject);
    if (initialFrame.width > 0 && initialFrame.height > 0) {
      renderer.setSize(
        initialFrame.width,
        initialFrame.height,
        Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO)
      );
    }
    const unsubscribe = clock.subscribe(invalidate);
    return () => {
      unsubscribe();
      stage.current = null;
      renderer.dispose();
    };
    // `createStageRenderer` changes identity when hot reload swaps its module, so an open editor gets the new code.
  }, [clock, createStageRenderer]);

  useEffect(() => {
    stage.current?.renderer.setProject(project);
    stage.current?.invalidate();
  }, [project]);

  useEffect(() => {
    if (frame.width === 0 || frame.height === 0) return;
    stage.current?.renderer.setSize(
      frame.width,
      frame.height,
      Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO)
    );
    stage.current?.invalidate();
  }, [frame.width, frame.height]);

  const pickAt = (x: number, y: number) =>
    frameElement ? clipAtPoint({ frameElement, project, time: clock.getState().time, layerAt, x, y }) : null;
  const textRect = (clipId: string) => (frameElement ? textRectFor(frameElement, clipId) : null);

  const { dragging, activeRing, blurHandle, handlers } = useCanvasDrag({
    element: frameElement,
    mode,
    project,
    clock,
    selectedClipId,
    frame,
    onSetProperty,
    layerGeometry: layerAt,
    gizmoAt: () => rotationGizmoTarget(latest.current, clock.getState().time, layerAt),
    selecting: tool === "select",
    pickAt,
    onPick: onSelectClip,
    blurGuidesAt: () => blurGuideTarget(latest.current, clock.getState().time, layerAt),
  });
  const hover = useStageHover({
    pick: (event) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      return pickAt(event.clientX - bounds.left, event.clientY - bounds.top);
    },
    selectedClipId,
    canSelect: (event) => event.buttons === 0 && !clock.getState().playing && !activeRing && !blurHandle,
    onSelect: (clipId) => onSelectClip(clipId, false),
  });
  const hoveredClipId = hover.hoveredClipId;
  useLayoutEffect(() => {
    latest.current = {
      project,
      frame,
      selectedClipId,
      singleClipSelected,
      mode,
      blurEditing,
      activeRing,
      hoveredClipId,
      outlineSelection: tool === "select",
      textRect,
      cursorFor: (clipId) => stage.current?.renderer.cursorFor(clipId) ?? null,
    };
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: the overlay reads these through `latest`; changing one must redraw it.
  useEffect(() => {
    stage.current?.invalidate();
  }, [blurEditing, mode, tool, selectedClipId, singleClipSelected, activeRing, hoveredClipId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/40">
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 px-3">
        <SegmentedRadioGroup
          aria-label={copy.canvasMode}
          onValueChange={(next) => {
            const picked = TOOLS.find((candidate) => candidate === next);
            if (picked) setTool(picked);
          }}
          size="sm"
          value={tool}>
          <SegmentedRadio title={copy.selectHint} value="select">
            <MousePointer2Icon aria-hidden="true" />
            {copy.select}
          </SegmentedRadio>
          <SegmentedRadio title={copy.cameraHint} value="camera">
            <HandIcon aria-hidden="true" />
            {copy.camera}
          </SegmentedRadio>
          <SegmentedRadio title={copy.orbitHint} value="orbit">
            <RotateCwIcon aria-hidden="true" />
            {copy.orbit}
          </SegmentedRadio>
          <SegmentedRadio title={copy.rotateHint} value="rotate">
            <BoxIcon aria-hidden="true" />
            {copy.rotate}
          </SegmentedRadio>
          <SegmentedRadio title={copy.focusHint} value="focus">
            <FocusIcon aria-hidden="true" />
            {copy.focus}
          </SegmentedRadio>
        </SegmentedRadioGroup>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={copy.refreshMedia}
                onClick={() => {
                  stage.current?.renderer.refreshMedia();
                  stage.current?.invalidate();
                }}
                size="icon-sm"
                variant="ghost"
              />
            }>
            <RefreshCwIcon aria-hidden="true" />
          </TooltipTrigger>
          <TooltipPopup>{copy.refreshMediaHint}</TooltipPopup>
        </Tooltip>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden" ref={setArea}>
        <div
          className={cn(
            "absolute touch-none select-none overflow-hidden shadow-lg/5",
            blurHandle === "angle" || blurHandle === "range"
              ? "cursor-pointer"
              : mode === "focus" || blurHandle === "focus"
                ? "cursor-crosshair"
                : activeRing
                  ? "cursor-pointer"
                  : dragging
                    ? "cursor-grabbing"
                    : tool === "select"
                      ? "cursor-default"
                      : "cursor-grab"
          )}
          ref={setFrameElement}
          style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
          {...handlers}
          onPointerDown={(event) => {
            hover.handlers.onPointerDown?.(event);
            handlers.onPointerDown?.(event);
          }}
          onPointerLeave={(event) => {
            hover.handlers.onPointerLeave?.(event);
            handlers.onPointerLeave?.(event);
          }}
          onPointerMove={(event) => {
            hover.handlers.onPointerMove?.(event);
            handlers.onPointerMove?.(event);
          }}>
          <canvas className="block size-full" ref={canvasRef} />
          <canvas
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full opacity-0 transition-opacity duration-150"
            ref={overlayRef}
          />
          {hasText ? <StageText clock={clock} frame={frame} project={project} /> : null}
          {failed ? (
            <p className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
              {copy.noWebgl}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
