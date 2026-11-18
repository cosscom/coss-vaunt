"use client";

import {
  type Clip,
  DRIFT_DIRECTIONS,
  DRIFT_MOTIONS,
  type Drift,
} from "@calcom/product-video/storyboard/storyboard-schema";
import { Label } from "@coss/ui/components/label";
import { Slider } from "@coss/ui/components/slider";
import { Switch } from "@coss/ui/components/switch";
import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import { SegmentedRadio, SegmentedRadioGroup } from "@coss/ui/shared/segmented-radio-group";
import type * as React from "react";
import { useId, useState } from "react";
import type { EditorState } from "../use-editor-state";
import { driftPath, focusFromPointer, focusPercent, nudgeFocus } from "./focus-point";
import { InspectorSection } from "./inspector-section";
import { useClipStill } from "./use-clip-still";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.drift;
/** The close-up lane on the timeline scrolls the inspector to this section. */
export const CLOSE_UP_SECTION_ID = "inspector-close-up";
const DEFAULT_DRIFT: Drift = {
  focus: { x: 0, y: 0 },
  zoom: 1.6,
  motion: "slide",
  direction: "left",
  intensity: 0.5,
};
const DIRECTION_ICONS = {
  left: ArrowLeftIcon,
  right: ArrowRightIcon,
  up: ArrowUpIcon,
  down: ArrowDownIcon,
} as const;

/** The clip's media with a draggable focus point and the frame the close-up will show around it. */
const THIRDS = [100 / 3, 200 / 3];
/** The frame moves against the media's travel, so its arrow points the other way. */
const ARROW_TURNS: Record<Drift["direction"], number> = { left: 0, right: 180, up: 90, down: -90 };

/** Guides drawn over the media like the easing plot: a dashed grid, the framed area and the drift's path. */
function PickerGuides({ drift }: { drift: Drift }): React.ReactElement {
  const x = ((drift.focus.x + 1) / 2) * 100;
  const y = ((drift.focus.y + 1) / 2) * 100;
  const size = 100 / drift.zoom;
  const path = driftPath(drift);
  // SVG `url(#…)` references break on the colons React puts in ids.
  const maskId = `drift${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      preserveAspectRatio="none"
      viewBox="0 0 100 100">
      <defs>
        <mask id={maskId}>
          <rect fill="white" height="100" width="100" />
          <rect fill="black" height={size} width={size} x={x - size / 2} y={y - size / 2} />
        </mask>
      </defs>
      <rect className="fill-background/56" height="100" mask={`url(#${maskId})`} width="100" />
      {THIRDS.map((at) => (
        <g className="stroke-foreground/24" key={at} strokeDasharray="3 3">
          <line vectorEffect="non-scaling-stroke" x1={at} x2={at} y1={0} y2={100} />
          <line vectorEffect="non-scaling-stroke" x1={0} x2={100} y1={at} y2={at} />
        </g>
      ))}
      <rect
        className="fill-info/8 stroke-info/72"
        height={size}
        strokeDasharray="4 3"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        width={size}
        x={x - size / 2}
        y={y - size / 2}
      />
      {path ? (
        <line
          className="stroke-info"
          strokeDasharray="3 3"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          x1={path.from.x}
          x2={path.to.x}
          y1={path.from.y}
          y2={path.to.y}
        />
      ) : null}
    </svg>
  );
}

/** The clip's media with a draggable focus point, the area the close-up frames and the way it drifts. */
function FocusPicker({
  clip,
  editor,
  drift,
  onChange,
}: {
  clip: Clip;
  editor: EditorState;
  drift: Drift;
  onChange: (focus: Drift["focus"]) => void;
}): React.ReactElement {
  const still = useClipStill(editor.project, clip);
  const [aspect, setAspect] = useState<number | null>(null);
  const shownAspect = still?.aspect ?? aspect ?? 16 / 10;
  const { focus } = drift;
  const marker = focusPercent(focus);
  const path = driftPath(drift);

  const track = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    onChange(focusFromPointer(box, event.clientX, event.clientY));
  };

  return (
    <div
      aria-label={copy.focus}
      aria-valuetext={copy.focusValue(Math.round(focus.x * 100), Math.round(focus.y * 100))}
      className="group/picker relative w-full cursor-crosshair touch-none select-none overflow-hidden rounded-lg border bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onKeyDown={(event) => {
        const next = nudgeFocus(focus, event.key, event.shiftKey);
        if (!next) return;
        event.preventDefault();
        onChange(next);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        track(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) track(event);
      }}
      role="slider"
      style={{ aspectRatio: shownAspect }}
      tabIndex={0}>
      {still?.kind === "image" ? (
        // biome-ignore lint/performance/noImgElement: a project file served by the studio, not a page asset
        <img
          alt=""
          className="pointer-events-none absolute inset-0 size-full object-cover"
          draggable={false}
          onLoad={(event) => setAspect(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)}
          src={still.url}
        />
      ) : null}
      {still?.kind === "video" ? (
        <video
          className="pointer-events-none absolute inset-0 size-full object-cover"
          muted
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            setAspect(video.videoWidth / video.videoHeight);
            video.currentTime = video.duration / 2;
          }}
          playsInline
          preload="metadata"
          src={still.url}
        />
      ) : null}
      <PickerGuides drift={drift} />
      {path ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute size-2 fill-info"
          style={{
            left: `${path.to.x}%`,
            top: `${path.to.y}%`,
            transform: `translate(-50%, -50%) rotate(${ARROW_TURNS[drift.direction]}deg)`,
          }}
          viewBox="0 0 8 8">
          <path d="M0,0 L8,4 L0,8 Z" />
        </svg>
      ) : null}
      {/* The easing editor's handle: a blue dot, with a halo on hover and focus. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-info/24 opacity-0 transition-opacity group-hover/picker:opacity-100 group-focus-visible/picker:opacity-100"
        style={marker}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-info bg-info group-focus-visible/picker:border-foreground"
        style={marker}
      />
    </div>
  );
}

function LabelledSlider({
  label,
  value,
  shown,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  shown: string;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}): React.ReactElement {
  return (
    <div className={cn("flex flex-col gap-2", disabled && "opacity-64")}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground tabular-nums">{shown}</span>
      </div>
      <Slider
        aria-label={label}
        className="[&_[data-slot=slider-control]]:min-w-0"
        disabled={disabled}
        max={max}
        min={min}
        onValueChange={(next) => {
          const single = Array.isArray(next) ? next[0] : next;
          if (typeof single === "number") onChange(single);
        }}
        step={step}
        value={value}
      />
    </div>
  );
}

/**
 * A close-up that drifts, like a product film: pick the point on the media to frame, how close, and how the
 * media travels across the clip. It sits on top of the clip's keyframes.
 */
export function DriftSection({ clip, editor }: { clip: Clip; editor: EditorState }): React.ReactElement {
  const drift = clip.drift;
  const set = (next: Drift | undefined) =>
    editor.editClip(clip.id, (current) => ({ ...current, drift: next }), `drift:${clip.id}`);
  const change = (patch: Partial<Drift>) => set({ ...(drift ?? DEFAULT_DRIFT), ...patch });
  const still = drift?.motion === "none";

  return (
    <div id={CLOSE_UP_SECTION_ID}>
      <InspectorSection
        action={
          <Switch
            aria-label={drift ? copy.turnOff : copy.turnOn}
            checked={drift !== undefined}
            onCheckedChange={(on) => set(on ? DEFAULT_DRIFT : undefined)}
          />
        }
        bodyClassName="gap-4"
        title={copy.title}>
        {drift ? (
          <>
            <div className="flex flex-col gap-2">
              <Label className="flex cursor-pointer items-center justify-between gap-2 font-normal">
                <span className="text-muted-foreground text-xs">{copy.followCursor}</span>
                <Switch
                  checked={drift.followCursor ?? false}
                  onCheckedChange={(followCursor) => change({ followCursor })}
                />
              </Label>
              {drift.followCursor ? (
                <p className="text-muted-foreground text-xs">{copy.followCursorHint}</p>
              ) : null}
            </div>
            <div className={cn(drift.followCursor && "opacity-64")}>
              <FocusPicker
                clip={clip}
                drift={drift}
                editor={editor}
                onChange={(focus) => change({ focus })}
              />
            </div>
            <LabelledSlider
              label={copy.zoom}
              max={4}
              min={1}
              onChange={(zoom) => change({ zoom })}
              shown={`${drift.zoom.toFixed(1)}×`}
              step={0.05}
              value={drift.zoom}
            />
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs">{copy.motion}</span>
              <SegmentedRadioGroup
                aria-label={copy.motion}
                className="w-full *:flex-1"
                onValueChange={(value) => {
                  const motion = DRIFT_MOTIONS.find((candidate) => candidate === value);
                  if (motion) change({ motion });
                }}
                size="sm"
                value={drift.motion}>
                {DRIFT_MOTIONS.map((motion) => (
                  <SegmentedRadio key={motion} value={motion}>
                    {copy.motions[motion]}
                  </SegmentedRadio>
                ))}
              </SegmentedRadioGroup>
            </div>
            <div className={cn("flex flex-col gap-2", still && "opacity-64")}>
              <span className="text-muted-foreground text-xs">{copy.direction}</span>
              <SegmentedRadioGroup
                aria-label={copy.direction}
                className="w-full *:flex-1"
                disabled={still}
                onValueChange={(value) => {
                  const direction = DRIFT_DIRECTIONS.find((candidate) => candidate === value);
                  if (direction) change({ direction });
                }}
                size="sm"
                value={drift.direction}>
                {DRIFT_DIRECTIONS.map((direction) => {
                  const Icon = DIRECTION_ICONS[direction];
                  return (
                    <SegmentedRadio aria-label={copy.directions[direction]} key={direction} value={direction}>
                      <Icon aria-hidden="true" />
                    </SegmentedRadio>
                  );
                })}
              </SegmentedRadioGroup>
            </div>
            <LabelledSlider
              disabled={still}
              label={copy.intensity}
              max={1}
              min={0}
              onChange={(intensity) => change({ intensity })}
              shown={`${Math.round(drift.intensity * 100)}%`}
              step={0.01}
              value={drift.intensity}
            />
          </>
        ) : (
          <p className="text-muted-foreground text-xs">{copy.description}</p>
        )}
      </InspectorSection>
    </div>
  );
}
