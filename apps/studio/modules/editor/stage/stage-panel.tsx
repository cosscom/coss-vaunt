"use client";

import type { CanvasMode } from "@calcom/product-video/stage/canvas-drag";
import { aspectRatioSize, letterbox } from "@calcom/product-video/stage/frame-letterbox";
import type { PropertyKey } from "@calcom/product-video/storyboard/property-specs";
import type { Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { activeClipsAt } from "@calcom/product-video/storyboard/track-resolution";
import { BoxIcon, HandIcon, RotateCwIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import { SegmentedRadio, SegmentedRadioGroup } from "@coss/ui/shared/segmented-radio-group";
import type * as React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type PlaybackClock, usePlaybackState } from "../player/playback-clock";
import { STAGE_COPY as copy } from "./stage-copy";
import { createStageRenderer, type StageRenderer } from "./stage-renderer";
import { textColorForBackground } from "./text/text-contrast";
import { TextOverlay } from "./text-overlay";
import { useCanvasDrag } from "./use-canvas-drag";

export type StagePanelProps = {
  project: Project;
  clock: PlaybackClock;
  selectedClipId: string | null;
  /** Called by canvas drags (Camera, Orbit and Rotate modes); the editor applies `setPropertyAt` at the playhead. */
  onSetProperty: (clipId: string, key: PropertyKey, value: number) => void;
};

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
  onSetProperty,
}: StagePanelProps): React.ReactElement {
  const [area, setArea] = useState<HTMLDivElement | null>(null);
  const [frameElement, setFrameElement] = useState<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stage = useRef<{ renderer: StageRenderer; invalidate: () => void } | null>(null);
  const [mode, setMode] = useState<CanvasMode>("camera");
  const [failed, setFailed] = useState(false);

  const areaSize = useElementSize(area);
  const frame = useMemo(
    () => letterbox(areaSize, aspectRatioSize(project.settings.aspectRatio), FRAME_PADDING),
    [areaSize, project.settings.aspectRatio]
  );
  const latest = useRef({ project, frame });
  useLayoutEffect(() => {
    latest.current = { project, frame };
  });
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
  }, [clock]);

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

  const { dragging, handlers } = useCanvasDrag({
    element: frameElement,
    mode,
    project,
    clock,
    selectedClipId,
    frame,
    onSetProperty,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/40">
      <div className="flex h-11 shrink-0 items-center px-3">
        <SegmentedRadioGroup
          aria-label={copy.canvasMode}
          onValueChange={(next) => {
            if (next === "camera" || next === "orbit" || next === "rotate") setMode(next);
          }}
          size="sm"
          value={mode}>
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
        </SegmentedRadioGroup>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden" ref={setArea}>
        <div
          className={cn(
            "absolute touch-none select-none overflow-hidden shadow-lg/5",
            dragging ? "cursor-grabbing" : "cursor-grab"
          )}
          ref={setFrameElement}
          style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
          {...handlers}>
          <canvas className="block size-full" ref={canvasRef} />
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
