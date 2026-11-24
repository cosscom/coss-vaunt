"use client";

import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@coss/ui/components/collapsible";
import { toastManager } from "@coss/ui/components/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { ChevronDownIcon } from "@coss/ui/icons";
import { SegmentedRadio, SegmentedRadioGroup } from "@coss/ui/shared/segmented-radio-group";
import type { MotionPlacement } from "@coss/vaunt-engine/catalogues/motion-presets/apply-motion-preset";
import {
  MOTION_PRESETS,
  type MotionPreset,
} from "@coss/vaunt-engine/catalogues/motion-presets/motion-presets";
import type * as React from "react";
import { useRef, useState } from "react";
import type { EditorState } from "../use-editor-state";
import { MOTION_DRAG_TYPE, serializeMotionDrag } from "./motion-drag";
import { motionPreviewFrames, previewStyle } from "./motion-preview";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.motion;
const GROUPS = ["device", "camera"] as const;

/** A stand-in for a recording: a window with a sidebar and a few rows, small enough to read its pose. */
function PreviewDevice({ deviceRef }: { deviceRef: React.Ref<HTMLDivElement> }): React.ReactElement {
  return (
    <div
      className="flex aspect-[16/10] w-[58%] overflow-hidden rounded-[5px] bg-card shadow-md/10 ring-1 ring-foreground/12 will-change-transform"
      ref={deviceRef}>
      <div className="w-[22%] border-e bg-muted/64" />
      <div className="flex flex-1 flex-col gap-[7%] p-[7%]">
        <div className="h-[9%] w-1/2 rounded-full bg-foreground/24" />
        <div className="h-[22%] rounded-[3px] bg-info/32" />
        <div className="h-[8%] w-4/5 rounded-full bg-foreground/12" />
        <div className="h-[8%] w-3/5 rounded-full bg-foreground/12" />
      </div>
    </div>
  );
}

function PresetTile({
  preset,
  placement,
  onApply,
}: {
  preset: MotionPreset;
  placement: MotionPlacement;
  onApply: () => void;
}): React.ReactElement {
  const device = useRef<HTMLDivElement>(null);
  const ghost = previewStyle(placement === "out" ? (preset.exit ?? preset.enter) : preset.enter);
  const animation = useRef<Animation | null>(null);

  const play = () => {
    const element = device.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    animation.current?.cancel();
    const { frames, durationMs } = motionPreviewFrames(preset, placement);
    animation.current = element.animate(frames, {
      duration: durationMs,
      iterations: Number.POSITIVE_INFINITY,
    });
  };
  const stop = () => {
    animation.current?.cancel();
    animation.current = null;
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            aria-label={copy.apply(preset.name)}
            className="group/tile flex cursor-grab flex-col gap-1.5 rounded-lg p-1 text-start outline-none transition-colors hover:bg-accent/48 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            draggable
            onBlur={stop}
            onClick={onApply}
            onDragEnd={stop}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "copy";
              event.dataTransfer.setData(
                MOTION_DRAG_TYPE,
                serializeMotionDrag({ presetId: preset.id, placement })
              );
            }}
            onFocus={play}
            onPointerEnter={play}
            onPointerLeave={stop}
            type="button"
          />
        }>
        <span className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted/48 [perspective:240px] group-hover/tile:border-foreground/16">
          <PreviewDevice deviceRef={device} />
          {/* Where the entrance starts, faint, so each tile reads before it plays; hidden while it does. */}
          <span
            aria-hidden="true"
            className="absolute aspect-[16/10] w-[58%] rounded-[5px] border border-info/64 border-dashed transition-opacity group-hover/tile:opacity-0 group-focus-visible/tile:opacity-0"
            style={{ transform: ghost.transform }}
          />
        </span>
        <span className="truncate px-0.5 text-foreground text-xs">{preset.name}</span>
      </TooltipTrigger>
      <TooltipPopup>{preset.description}</TooltipPopup>
    </Tooltip>
  );
}

/**
 * Ready-made 3D moves, previewed on hover. Drag one onto a clip in the timeline, or click it to apply it to the
 * selected clip: it keys the entrance at the clip's start and the exit at its end.
 */
export function MotionSection({ editor }: { editor: EditorState }): React.ReactElement {
  const [placement, setPlacement] = useState<MotionPlacement>("both");
  const clip = editor.primaryClip;

  const apply = (preset: MotionPreset) => {
    if (!clip) {
      toastManager.add({ type: "info", title: copy.selectClipFirst });
      return;
    }
    editor.applyMotionPreset(clip.id, preset.id, placement);
  };

  return (
    <Collapsible className="shrink-0 border-t">
      <CollapsibleTrigger className="group flex h-10 w-full cursor-pointer items-center gap-2 px-4 text-start outline-none hover:bg-accent/40 focus-visible:bg-accent/60">
        <span className="flex-1 font-medium text-foreground text-sm">{copy.title}</span>
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 -rotate-90 text-muted-foreground transition-transform group-data-panel-open:rotate-0"
        />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="flex flex-col gap-3 px-4 pt-1 pb-4">
          <SegmentedRadioGroup
            aria-label={copy.placement}
            className="w-full *:flex-1"
            onValueChange={(value) => {
              if (value === "in" || value === "out" || value === "both") setPlacement(value);
            }}
            size="sm"
            value={placement}>
            <SegmentedRadio value="in">{copy.placements.in}</SegmentedRadio>
            <SegmentedRadio value="out">{copy.placements.out}</SegmentedRadio>
            <SegmentedRadio value="both">{copy.placements.both}</SegmentedRadio>
          </SegmentedRadioGroup>
          {GROUPS.map((group) => (
            <section aria-label={copy.groups[group]} className="flex flex-col gap-1" key={group}>
              <h3 className="px-0.5 text-muted-foreground text-xs">{copy.groups[group]}</h3>
              <div className="-mx-1 grid grid-cols-3 gap-0.5">
                {MOTION_PRESETS.filter((preset) => preset.group === group).map((preset) => (
                  <PresetTile
                    key={preset.id}
                    onApply={() => apply(preset)}
                    placement={placement}
                    preset={preset}
                  />
                ))}
              </div>
            </section>
          ))}
          <p className="text-muted-foreground text-xs">{clip ? copy.hint : copy.selectClipFirst}</p>
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
