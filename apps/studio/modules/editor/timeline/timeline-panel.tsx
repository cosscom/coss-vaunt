"use client";

import { PROPERTY_KEYS } from "@calcom/product-video/storyboard/property-specs";
import { frameTolerance } from "@calcom/product-video/storyboard/storyboard-edits";
import { projectDuration } from "@calcom/product-video/storyboard/track-resolution";
import { ContextMenu, ContextMenuTrigger } from "@coss/ui/components/context-menu";
import type * as React from "react";
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { ASSET_DRAG_TYPE, parseAssetDrag } from "../assets/asset-drag";
import { mediaFilesFromDrop } from "../media/clipboard-media";
import type { PlaybackClock } from "../player/playback-clock";
import type { EditorState } from "../use-editor-state";
import { AudioTracks } from "./audio/audio-tracks";
import { NewVideoTrackRow } from "./new-video-track-row";
import { TimelineContextMenu, type TimelineMenuTarget } from "./timeline-context-menu";
import {
  CONTENT_PADDING_PX,
  MIN_VISIBLE_SECONDS,
  RULER_HEIGHT_PX,
  TAIL_SECONDS,
  TRACK_HEADER_WIDTH_PX,
} from "./timeline-metrics";
import { RulerPlayheadHead, TimelinePlayhead } from "./timeline-playhead";
import { TimelineRuler } from "./timeline-ruler";
import {
  clampPxPerSecond,
  DEFAULT_PX_PER_SECOND,
  fitPxPerSecond,
  wheelZoomFactor,
  zoomAroundPointer,
  zoomTimeline,
} from "./timeline-scale";
import { TimelineTransport } from "./timeline-transport";
import { DeleteTrackDialog, RenameTrackDialog } from "./track-dialogs";
import { useTimelineGestures } from "./use-timeline-gestures";
import { VideoTrackRow } from "./video-track-row";
import { STUDIO_COPY } from "@/modules/studio-copy";

export type TimelineHandle = { zoom: (direction: "in" | "out" | "fit") => void };

type TimelinePanelProps = {
  editor: EditorState;
  clock: PlaybackClock;
  ref?: React.Ref<TimelineHandle>;
};

type SafariGestureEvent = Event & { scale: number; clientX: number };

function useElementWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

function menuTargetFrom(element: Element | null, time: number): TimelineMenuTarget {
  const source = element?.closest<HTMLElement>("[data-menu]");
  const data = source?.dataset ?? {};
  const trackIndex = Number(data.trackIndex);
  const key = PROPERTY_KEYS.find((candidate) => candidate === data.key);
  switch (data.menu) {
    case "clip":
    case "transition":
      return data.clipId ? { kind: data.menu, clipId: data.clipId } : { kind: "empty", time };
    case "keyframe":
      return data.clipId && key && data.keyframeId
        ? { kind: "keyframe", clipId: data.clipId, key, keyframeId: data.keyframeId }
        : { kind: "empty", time };
    case "lane":
      return data.clipId && key ? { kind: "lane", clipId: data.clipId, key } : { kind: "empty", time };
    case "track":
      return { kind: "track", trackIndex };
    case "video-lane":
    case "audio-lane":
      return { kind: data.menu, trackIndex, time };
    default:
      return { kind: "empty", time };
  }
}

export function TimelinePanel({ editor, clock, ref }: TimelinePanelProps): React.ReactElement {
  const { project, selection } = editor;
  const [pxPerSecond, setPxPerSecond] = useState(DEFAULT_PX_PER_SECOND);
  const [collapsedTracks, setCollapsedTracks] = useState<ReadonlySet<string>>(new Set());
  const [menuTarget, setMenuTarget] = useState<TimelineMenuTarget | null>(null);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const importTarget = useRef<{ time: number; trackIndex: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<number | null>(null);
  const zoomState = useRef({ pxPerSecond });
  zoomState.current.pxPerSecond = pxPerSecond;
  const viewportWidth = useElementWidth(scrollRef);
  const gestures = useTimelineGestures({ editor, clock, pxPerSecond, contentRef, bodyRef });

  const view = gestures.draft ?? project;
  const laneWidth = viewportWidth - TRACK_HEADER_WIDTH_PX - CONTENT_PADDING_PX * 2;
  const visibleSeconds = Math.max(
    MIN_VISIBLE_SECONDS,
    Math.ceil(projectDuration(view) + TAIL_SECONDS),
    Math.floor(laneWidth / pxPerSecond)
  );
  const contentWidth = Math.max(
    visibleSeconds * pxPerSecond + CONTENT_PADDING_PX * 2,
    viewportWidth - TRACK_HEADER_WIDTH_PX
  );
  const toX = (seconds: number) => CONTENT_PADDING_PX + seconds * pxPerSecond;

  const zoomAt = (clientX: number, factor: number) => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    const next = zoomAroundPointer({
      pxPerSecond: zoomState.current.pxPerSecond,
      scrollLeft: scroller.scrollLeft,
      pointerX: clientX - content.getBoundingClientRect().left,
      padding: CONTENT_PADDING_PX,
      factor,
    });
    zoomState.current.pxPerSecond = next.pxPerSecond;
    pendingScroll.current = next.scrollLeft;
    setPxPerSecond(next.pxPerSecond);
  };

  useLayoutEffect(() => {
    if (pendingScroll.current === null || !scrollRef.current) return;
    scrollRef.current.scrollLeft = pendingScroll.current;
    pendingScroll.current = null;
  });

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    let gestureScale = 1;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomAt(event.clientX, wheelZoomFactor(event.deltaY));
    };
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureScale = 1;
    };
    const onGestureChange = (event: Event) => {
      const gesture = event as SafariGestureEvent;
      event.preventDefault();
      zoomAt(gesture.clientX, gesture.scale / gestureScale);
      gestureScale = gesture.scale;
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    scroller.addEventListener("gesturestart", onGestureStart);
    scroller.addEventListener("gesturechange", onGestureChange);
    return () => {
      scroller.removeEventListener("wheel", onWheel);
      scroller.removeEventListener("gesturestart", onGestureStart);
      scroller.removeEventListener("gesturechange", onGestureChange);
    };
  });

  const zoom = (direction: "in" | "out" | "fit") => {
    if (direction === "fit") {
      pendingScroll.current = 0;
      setPxPerSecond(fitPxPerSecond(projectDuration(project), laneWidth));
      return;
    }
    const scroller = scrollRef.current;
    const content = contentRef.current;
    const playheadX = content ? content.getBoundingClientRect().left + toX(clock.getState().time) : 0;
    const visible = scroller && content ? scroller.getBoundingClientRect() : null;
    const anchor =
      visible && playheadX > visible.left + TRACK_HEADER_WIDTH_PX && playheadX < visible.right
        ? playheadX
        : (visible?.left ?? 0) + TRACK_HEADER_WIDTH_PX;
    zoomAt(anchor, clampPxPerSecond(zoomTimeline(pxPerSecond, direction)) / pxPerSecond);
  };

  useImperativeHandle(ref, () => ({ zoom }));

  const openImport = (time: number, trackIndex: number) => {
    importTarget.current = { time, trackIndex };
    fileInputRef.current?.click();
  };

  const toggleLanes = (trackId: string) =>
    setCollapsedTracks((current) => {
      const next = new Set(current);
      if (!next.delete(trackId)) next.add(trackId);
      return next;
    });

  const selectedClipIds = new Set(selection.clipIds);
  const selectedKeyframeIds = new Set(selection.keyframes.map((keyframe) => keyframe.keyframeId));
  const primaryId = editor.primaryClip?.id ?? null;
  const hasClips = view.videoTracks.some((track) => track.clips.length > 0);
  /** An asset from the assets pane, or files from the desktop; `trackIndex` one above the top track adds one. */
  const dropMedia = (dataTransfer: DataTransfer, clientX: number, trackIndex: number) => {
    const asset = parseAssetDrag(dataTransfer.getData(ASSET_DRAG_TYPE), "video");
    const time = gestures.timeAt(clientX);
    if (asset?.kind === "video" && asset.recordingOf)
      void editor.placeTakeAt(asset.clip, asset.recordingOf, time, trackIndex);
    else if (asset?.kind === "video") editor.placeAssetAt(asset.clip, time, trackIndex);
    else void editor.importMediaAt(mediaFilesFromDrop(dataTransfer), time, trackIndex);
  };
  const videoTracks = view.videoTracks.map((track, trackIndex) => ({ track, trackIndex })).reverse();

  return (
    <section aria-label={STUDIO_COPY.timeline.label} className="flex h-full min-h-0 flex-col">
      <TimelineTransport
        clock={clock}
        onAddClip={editor.addClip}
        onAddTrack={editor.addTrack}
        onImportMedia={() => openImport(clock.getState().time, 0)}
        onImported={editor.insertImported}
        onZoom={zoom}
        projectId={project.id}
      />
      <input
        accept="video/*,image/*"
        className="hidden"
        data-testid="media-file-input"
        multiple
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          const target = importTarget.current;
          event.target.value = "";
          if (target) void editor.importMediaAt(files, target.time, target.trackIndex);
        }}
        ref={fileInputRef}
        type="file"
      />
      <ContextMenu>
        <ContextMenuTrigger
          className="relative min-h-0 flex-1 overflow-auto overscroll-contain"
          onContextMenu={(event) => {
            const target = menuTargetFrom(
              event.target instanceof Element ? event.target : null,
              gestures.timeAt(event.clientX)
            );
            if (target.kind === "clip" && !selectedClipIds.has(target.clipId))
              editor.selectClip(target.clipId);
            if (target.kind === "keyframe" && !selectedKeyframeIds.has(target.keyframeId)) {
              editor.selectKeyframes(
                [{ clipId: target.clipId, key: target.key, keyframeId: target.keyframeId }],
                false
              );
            }
            setMenuTarget(target);
          }}
          data-timeline-scroller=""
          ref={scrollRef}>
          <div className="relative" ref={bodyRef} style={{ width: TRACK_HEADER_WIDTH_PX + contentWidth }}>
            <div
              className="sticky top-0 z-30 flex border-b bg-background"
              style={{ height: RULER_HEIGHT_PX }}>
              <div
                className="sticky left-0 z-10 shrink-0 border-e bg-background"
                style={{ width: TRACK_HEADER_WIDTH_PX }}
              />
              <div className="relative" ref={contentRef} style={{ width: contentWidth }}>
                <TimelineRuler
                  onPointerDown={gestures.onRulerPointerDown}
                  pxPerSecond={pxPerSecond}
                  toX={toX}
                  visibleSeconds={visibleSeconds}
                />
                <RulerPlayheadHead clock={clock} toX={toX} />
              </div>
            </div>

            <TimelinePlayhead clock={clock} offset={TRACK_HEADER_WIDTH_PX} scrollRef={scrollRef} toX={toX} />

            <NewVideoTrackRow
              contentWidth={contentWidth}
              left={toX(0)}
              onDropFiles={(dataTransfer, clientX) =>
                dropMedia(dataTransfer, clientX, project.videoTracks.length)
              }
              trackIndex={project.videoTracks.length}
            />
            {videoTracks.map(({ track, trackIndex }) => (
              <VideoTrackRow
                clock={clock}
                contentWidth={contentWidth}
                emptyHint={!hasClips && trackIndex === 0}
                key={track.id}
                lanesOpen={!collapsedTracks.has(track.id)}
                onSelectLane={editor.selectLane}
                onShowLane={(key) => {
                  editor.showLane(key);
                  setCollapsedTracks((current) => {
                    const next = new Set(current);
                    next.delete(track.id);
                    return next;
                  });
                }}
                selectedLanes={editor.selectedLanes}
                shownLanes={editor.shownLanes}
                onClipPointerDown={(event, clip, mode) =>
                  gestures.onClipPointerDown(event, clip, trackIndex, mode)
                }
                onDropFiles={(dataTransfer, clientX) => dropMedia(dataTransfer, clientX, trackIndex)}
                onMotionDrop={(clipId, drop) => {
                  editor.applyMotionPreset(clipId, drop.presetId, drop.placement);
                  setCollapsedTracks((current) => {
                    const next = new Set(current);
                    next.delete(track.id);
                    return next;
                  });
                }}
                onKeyframePointerDown={(event, clip, keyframe, key) =>
                  gestures.onKeyframePointerDown(event, clip, key, keyframe)
                }
                onMarqueePointerDown={gestures.onMarqueePointerDown}
                onSelectClip={(clipId) => editor.selectClip(clipId)}
                onSelectTransition={(clipId) => editor.selectClip(clipId, { transition: true })}
                onToggleHidden={() => editor.setTrackHidden(trackIndex, !track.hidden)}
                onToggleLanes={() => toggleLanes(track.id)}
                primaryClipId={primaryId}
                pxPerSecond={pxPerSecond}
                selectedClipIds={selectedClipIds}
                keyframeTolerance={frameTolerance(project.settings.fps)}
                selectedKeyframeIds={selectedKeyframeIds}
                toX={toX}
                track={track}
                trackIndex={trackIndex}
              />
            ))}
            <AudioTracks
              clock={clock}
              contentWidth={contentWidth}
              editor={editor}
              pxPerSecond={pxPerSecond}
              toX={toX}
            />
            {gestures.marquee ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-25 rounded-xs border border-info/64 bg-info/12"
                data-testid="marquee"
                style={gestures.marquee}
              />
            ) : null}
          </div>
        </ContextMenuTrigger>
        <TimelineContextMenu
          clock={clock}
          editor={editor}
          onDeleteTrack={(trackIndex) => {
            if ((project.videoTracks[trackIndex]?.clips.length ?? 0) > 0) setDeleting(trackIndex);
            else editor.deleteTrack(trackIndex);
          }}
          onImportMedia={openImport}
          onRenameTrack={setRenaming}
          target={menuTarget}
        />
      </ContextMenu>
      <RenameTrackDialog
        name={renaming === null ? "" : (project.videoTracks[renaming]?.name ?? "")}
        onOpenChange={(open) => !open && setRenaming(null)}
        onSubmit={(name) => {
          if (renaming !== null) editor.renameTrack(renaming, name);
          setRenaming(null);
        }}
        open={renaming !== null}
      />
      <DeleteTrackDialog
        clipCount={deleting === null ? 0 : (project.videoTracks[deleting]?.clips.length ?? 0)}
        name={deleting === null ? "" : (project.videoTracks[deleting]?.name ?? "")}
        onConfirm={() => {
          if (deleting !== null) editor.deleteTrack(deleting);
          setDeleting(null);
        }}
        onOpenChange={(open) => !open && setDeleting(null)}
        open={deleting !== null}
      />
    </section>
  );
}
