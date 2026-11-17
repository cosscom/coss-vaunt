"use client";

import { PROPERTY_SPECS } from "@calcom/product-video/storyboard/property-specs";
import {
  NumberField,
  NumberFieldGroup,
  NumberFieldInput,
  NumberFieldScrubArea,
} from "@coss/ui/components/number-field";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useId, useRef, useState } from "react";
import type { KeyframeState } from "./keyframe-state";
import { KeyframeToggle } from "./keyframe-toggle";
import { propertyFormat } from "./property-controls";
import { ROTATION_SPHERE_COPY } from "./rotation-sphere-copy";
import {
  circlePaths,
  type DragZone,
  dragRotation,
  dragZone,
  EQUATOR,
  FACE,
  keyboardNudge,
  meridian,
  POLE,
  type Point,
  PRIME_MERIDIAN,
  projectPoint,
  type Rotation,
  ringAngle,
  ringRotation,
  type SphereCircle,
  viewMatrix,
} from "./rotation-sphere-geometry";

type RotationKey = "rotateX" | "rotateY" | "rotateZ";

const SIZE = 176;
const RING = 12;
const FRAME = { cx: SIZE / 2, cy: SIZE / 2, r: SIZE / 2 - RING - 2 };
const AXES: RotationKey[] = ["rotateX", "rotateY", "rotateZ"];
const WIREFRAME: SphereCircle[] = [meridian(60), meridian(120)];
const HIGHLIGHTED: SphereCircle[] = [EQUATOR, PRIME_MERIDIAN];

type Drag = { zone: DragZone; start: Point; startAngle: number; startRotation: Rotation; last: Rotation };

function svgPoint(event: React.PointerEvent<SVGSVGElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * SIZE,
    y: ((event.clientY - rect.top) / rect.height) * SIZE,
  };
}

function SphereLines({ rotation }: { rotation: Rotation }): React.ReactElement {
  const m = viewMatrix(rotation);
  const wireframe = WIREFRAME.map((circle) => circlePaths(circle, m, FRAME));
  const highlighted = HIGHLIGHTED.map((circle) => circlePaths(circle, m, FRAME));
  const pole = projectPoint(m, POLE, FRAME);
  const face = projectPoint(m, FACE, FRAME);
  const handles = [
    { point: pole, r: 5.5, className: "fill-foreground" },
    { point: face, r: 6.5, className: "fill-(--studio-accent)" },
  ].sort((a, b) => a.point.depth - b.point.depth);
  return (
    <g className="pointer-events-none" fill="none" strokeLinecap="round">
      <path
        className="stroke-foreground/14"
        d={wireframe.map((paths) => paths.back).join("")}
        strokeDasharray="1.5 3"
      />
      <path
        className="stroke-(--studio-accent) opacity-40"
        d={highlighted.map((paths) => paths.back).join("")}
        strokeDasharray="1.5 3"
      />
      <path className="stroke-foreground/28" d={wireframe.map((paths) => paths.front).join("")} />
      <path
        className="stroke-(--studio-accent)"
        d={highlighted.map((paths) => paths.front).join("")}
        strokeWidth={1.5}
      />
      {handles.map(({ point, r, className }) => (
        <circle
          className={cn("stroke-background", className, point.depth < 0 && "opacity-40")}
          cx={point.x}
          cy={point.y}
          key={r}
          r={r}
          strokeWidth={2}
        />
      ))}
    </g>
  );
}

function useSphereDrag(rotation: Rotation, onChange: RotationSphereProps["onChange"]) {
  const drag = useRef<Drag | null>(null);
  const [activeZone, setActiveZone] = useState<DragZone | null>(null);

  const emit = (next: Partial<Rotation>) => {
    const current = drag.current;
    if (!current) return;
    for (const key of AXES) {
      const value = next[key];
      if (value === undefined || value === current.last[key]) continue;
      current.last = { ...current.last, [key]: value };
      onChange(key, value);
    }
  };

  const endDrag = () => {
    drag.current = null;
    setActiveZone(null);
  };

  return {
    activeZone,
    onPointerDown: (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return;
      const start = svgPoint(event);
      const zone = dragZone(start, FRAME, RING + 2);
      if (!zone) return;
      event.preventDefault();
      // Focus stays off the sphere and inputs so playhead keys (End, arrows) still move the playhead after a drag.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {
        zone,
        start,
        startAngle: ringAngle(start, FRAME),
        startRotation: rotation,
        last: rotation,
      };
      setActiveZone(zone);
    },
    onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => {
      const current = drag.current;
      if (!current) return;
      const point = svgPoint(event);
      if (current.zone === "ring") {
        const angle = ringAngle(point, FRAME);
        emit({
          rotateZ: ringRotation(current.startRotation.rotateZ, current.startAngle, angle, event.shiftKey),
        });
        return;
      }
      const delta = { x: point.x - current.start.x, y: point.y - current.start.y };
      emit(dragRotation(current.startRotation, delta, FRAME.r, event.shiftKey));
    },
    onPointerUp: endDrag,
    onLostPointerCapture: endDrag,
  };
}

function SphereBezel({ rotateZ, active }: { rotateZ: number; active: boolean }): React.ReactElement {
  const angle = ((90 + rotateZ) * Math.PI) / 180;
  const along = (distance: number) => ({
    x: FRAME.cx + Math.cos(angle) * distance,
    y: FRAME.cy - Math.sin(angle) * distance,
  });
  const inner = along(FRAME.r + 3);
  const outer = along(FRAME.r + RING - 3);
  return (
    <>
      <circle
        className={cn(
          "fill-foreground/4 stroke-border transition-colors hover:fill-foreground/7",
          active && "fill-foreground/7"
        )}
        cx={FRAME.cx}
        cy={FRAME.cy}
        r={FRAME.r + RING}
      />
      <line
        className={cn("pointer-events-none stroke-foreground/40", active && "stroke-(--studio-accent)")}
        strokeLinecap="round"
        strokeWidth={2}
        x1={inner.x}
        x2={outer.x}
        y1={inner.y}
        y2={outer.y}
      />
    </>
  );
}

function AxisRow({
  axis,
  value,
  keyframe,
  onChange,
  onToggleKeyframe,
  disabled,
}: {
  axis: RotationKey;
  value: number;
  keyframe: KeyframeState;
  onChange: RotationSphereProps["onChange"];
  onToggleKeyframe: RotationSphereProps["onToggleKeyframe"];
  disabled?: boolean;
}): React.ReactElement {
  const spec = PROPERTY_SPECS[axis];
  return (
    <NumberField
      className="grid grid-cols-[0.75rem_4.5rem_1.75rem] items-center gap-x-2 gap-y-0"
      disabled={disabled}
      format={propertyFormat(spec)}
      max={spec.max}
      min={spec.min}
      onValueChange={(next) => next !== null && next !== value && onChange(axis, next)}
      size="sm"
      step={spec.step}
      value={value}>
      <NumberFieldScrubArea
        className="*:data-[slot=label]:font-normal *:data-[slot=label]:text-muted-foreground *:data-[slot=label]:text-xs"
        label={ROTATION_SPHERE_COPY.axes[axis]}
      />
      <NumberFieldGroup>
        <NumberFieldInput
          aria-label={spec.label}
          className="px-2 text-end tabular-nums"
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        />
      </NumberFieldGroup>
      <KeyframeToggle label={spec.label} onToggle={() => onToggleKeyframe(axis)} state={keyframe} />
    </NumberField>
  );
}

export type RotationSphereProps = {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  keyframes: Record<RotationKey, KeyframeState>;
  onChange: (key: RotationKey, value: number) => void;
  onToggleKeyframe: (key: RotationKey) => void;
  onReset: () => void;
  disabled?: boolean;
};

export function RotationSphere({
  rotateX,
  rotateY,
  rotateZ,
  keyframes,
  onChange,
  onToggleKeyframe,
  onReset,
  disabled,
}: RotationSphereProps): React.ReactElement {
  const instructionsId = useId();
  const rotation = { rotateX, rotateY, rotateZ };
  const { activeZone, ...pointerHandlers } = useSphereDrag(rotation, onChange);

  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const nudge = keyboardNudge(event.code, event.shiftKey, rotation);
    if (!nudge) return;
    event.preventDefault();
    if (nudge.value !== rotation[nudge.key]) onChange(nudge.key, nudge.value);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 [--studio-accent:var(--info)]",
        disabled && "pointer-events-none opacity-64"
      )}>
      <svg
        aria-describedby={instructionsId}
        aria-disabled={disabled || undefined}
        aria-label={ROTATION_SPHERE_COPY.label}
        aria-roledescription={ROTATION_SPHERE_COPY.roleDescription}
        aria-valuemax={PROPERTY_SPECS.rotateY.max}
        aria-valuemin={PROPERTY_SPECS.rotateY.min}
        aria-valuenow={rotateY}
        aria-valuetext={ROTATION_SPHERE_COPY.valueText(rotateX, rotateY, rotateZ)}
        className={cn(
          "aspect-square min-w-0 max-w-44 flex-1 touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          activeZone ? "cursor-grabbing" : "cursor-grab"
        )}
        data-testid="rotation-sphere"
        onDoubleClick={onReset}
        onKeyDown={disabled ? undefined : onKeyDown}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        {...(disabled ? {} : pointerHandlers)}>
        <SphereBezel active={activeZone === "ring"} rotateZ={rotateZ} />
        <circle
          className="fill-background stroke-border dark:fill-black/40"
          cx={FRAME.cx}
          cy={FRAME.cy}
          r={FRAME.r}
        />
        <SphereLines rotation={rotation} />
      </svg>
      <span className="sr-only" id={instructionsId}>
        {ROTATION_SPHERE_COPY.instructions}
      </span>
      <div className="flex shrink-0 flex-col gap-1.5">
        {AXES.map((axis) => (
          <AxisRow
            axis={axis}
            disabled={disabled}
            key={axis}
            keyframe={keyframes[axis]}
            onChange={onChange}
            onToggleKeyframe={onToggleKeyframe}
            value={rotation[axis]}
          />
        ))}
      </div>
    </div>
  );
}
