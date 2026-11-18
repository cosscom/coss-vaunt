"use client";

import { aspectRatioSize } from "@calcom/product-video/stage/frame-letterbox";
import { evaluateProperty } from "@calcom/product-video/storyboard/property-evaluation";
import {
  PROPERTY_KEYS,
  PROPERTY_SPECS,
  type PropertyGroup,
  type PropertyKey,
} from "@calcom/product-video/storyboard/property-specs";
import { editLocalTime, frameTolerance } from "@calcom/product-video/storyboard/storyboard-edits";
import type { Clip } from "@calcom/product-video/storyboard/storyboard-schema";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuPopup,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@coss/ui/components/context-menu";
import type * as React from "react";
import { useState } from "react";
import { MenuShortcut } from "../menu-shortcut";
import { type PlaybackClock, usePlaybackState } from "../player/playback-clock";
import { formatTimecode } from "../timeline/format-timecode";
import { keyframeCount } from "../timeline/keyframed-properties";
import type { EditorState } from "../use-editor-state";
import { InspectorNumberRow } from "./inspector-number-row";
import { InspectorSection } from "./inspector-section";
import { keyframeState } from "./keyframe-state";
import { propertyFormat, propertySliderRange } from "./property-controls";
import { RotationSphere } from "./rotation-sphere";
import { TransformPad } from "./transform-pad";
import { STUDIO_COPY } from "@/modules/studio-copy";

const ROTATION_KEYS = ["rotateX", "rotateY", "rotateZ"] as const;
const TRANSFORM_KEYS = ["x", "y", "scale"] as const;
const menuCopy = STUDIO_COPY.timeline.menu;

type PropertyGroupSectionProps = {
  title: string;
  group: PropertyGroup;
  clip: Clip;
  clock: PlaybackClock;
  editor: EditorState;
  /** The group's rows to show, in this order; every row of the group by default. */
  keys?: readonly PropertyKey[];
  action?: React.ReactNode;
  children?: React.ReactNode;
};

/** Reads the playhead itself so playback re-renders only these rows. Device rotation uses the sphere. */
export function PropertyGroupSection({
  title,
  group,
  clip,
  clock,
  editor,
  keys: shownKeys,
  action,
  children,
}: PropertyGroupSectionProps): React.ReactElement {
  const time = usePlaybackState(clock, (state) => state.time);
  const [menuKey, setMenuKey] = useState<PropertyKey | null>(null);
  const localTime = editLocalTime(clip, time, editor.project.settings.fps);
  const tolerance = frameTolerance(editor.project.settings.fps);
  const withSphere = group === "device";
  const withPad = group === "clip";
  const keys =
    shownKeys ??
    PROPERTY_KEYS.filter(
      (key) =>
        PROPERTY_SPECS[key].group === group &&
        !(withSphere && ROTATION_KEYS.some((rotation) => rotation === key)) &&
        !(withPad && TRANSFORM_KEYS.some((transform) => transform === key))
    );
  const output = aspectRatioSize(editor.project.settings.aspectRatio);
  const count = keyframeCount(clip, group);
  const currentValue = (key: PropertyKey) => {
    const property = clip.properties[key];
    return property ? evaluateProperty(property, localTime) : PROPERTY_SPECS[key].defaultValue;
  };
  const menuState = menuKey ? keyframeState(clip.properties[menuKey], localTime, tolerance) : "none";

  return (
    <InspectorSection
      action={action}
      aside={
        <span className="flex items-center gap-2">
          {count > 0 ? (
            <span data-testid="keyframe-count">{STUDIO_COPY.inspector.keyframeCount(count)}</span>
          ) : null}
          <span>{formatTimecode(localTime)}</span>
        </span>
      }
      title={title}>
      {children}
      <ContextMenu>
        <ContextMenuTrigger
          className="flex flex-col gap-2"
          onContextMenu={(event) => {
            const key = PROPERTY_KEYS.find(
              (candidate) =>
                candidate ===
                (event.target instanceof Element
                  ? event.target.closest<HTMLElement>("[data-property-key]")?.dataset.propertyKey
                  : undefined)
            );
            setMenuKey(key ?? null);
          }}>
          {withSphere ? (
            <div className="flex flex-col gap-1.5" data-property-key={lastRotationKey(editor.lastProperty)}>
              <span className="text-muted-foreground text-xs">{STUDIO_COPY.inspector.rotation}</span>
              <RotationSphere
                keyframes={{
                  rotateX: keyframeState(clip.properties.rotateX, localTime, tolerance),
                  rotateY: keyframeState(clip.properties.rotateY, localTime, tolerance),
                  rotateZ: keyframeState(clip.properties.rotateZ, localTime, tolerance),
                }}
                onChange={(key, value) =>
                  editor.setCompoundAtPlayhead(clip.id, key, value, `rotation:${clip.id}`)
                }
                onReset={() => {
                  for (const key of ROTATION_KEYS)
                    editor.setCompoundAtPlayhead(clip.id, key, 0, `rotation:${clip.id}`);
                }}
                onToggleKeyframe={(key) => editor.toggleCompoundKeyframe(clip.id, key)}
                rotateX={currentValue("rotateX")}
                rotateY={currentValue("rotateY")}
                rotateZ={currentValue("rotateZ")}
              />
            </div>
          ) : null}
          {withPad ? (
            <div data-property-key={lastTransformKey(editor.lastProperty)}>
              <TransformPad
                aspect={output.width / output.height}
                keyframes={{
                  x: keyframeState(clip.properties.x, localTime, tolerance),
                  y: keyframeState(clip.properties.y, localTime, tolerance),
                  scale: keyframeState(clip.properties.scale, localTime, tolerance),
                }}
                onChange={(key, value) =>
                  editor.setCompoundAtPlayhead(clip.id, key, value, `transform:${clip.id}`)
                }
                onReset={() => {
                  for (const key of TRANSFORM_KEYS)
                    editor.setCompoundAtPlayhead(
                      clip.id,
                      key,
                      PROPERTY_SPECS[key].defaultValue,
                      `transform:${clip.id}`
                    );
                }}
                onToggleKeyframe={(key) => editor.toggleKeyframe(clip.id, key)}
                scale={currentValue("scale")}
                x={currentValue("x")}
                y={currentValue("y")}
              />
            </div>
          ) : null}
          {keys.map((key) => {
            const spec = PROPERTY_SPECS[key];
            return (
              <div data-property-key={key} key={key}>
                <InspectorNumberRow
                  format={propertyFormat(spec)}
                  keyframe={{
                    state: keyframeState(clip.properties[key], localTime, tolerance),
                    onToggle: () => editor.toggleKeyframe(clip.id, key),
                  }}
                  label={spec.label}
                  max={spec.max}
                  min={spec.min}
                  onChange={(value) => editor.setPropertyAtPlayhead(clip.id, key, value)}
                  sliderRange={propertySliderRange(key, spec)}
                  step={spec.step}
                  value={currentValue(key)}
                />
              </div>
            );
          })}
        </ContextMenuTrigger>
        {menuKey ? (
          <ContextMenuPopup className="min-w-56">
            <ContextMenuItem onClick={() => editor.toggleKeyframe(clip.id, menuKey)}>
              {menuState === "at-playhead"
                ? STUDIO_COPY.inspector.removeKeyframe
                : STUDIO_COPY.inspector.addKeyframe}
              <MenuShortcut action="toggle-keyframe" />
            </ContextMenuItem>
            <ContextMenuItem onClick={() => editor.resetProperty(clip.id, menuKey)}>
              {menuCopy.resetToDefault}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => editor.copyValue(currentValue(menuKey))}>
              {menuCopy.copyValue}
            </ContextMenuItem>
            <ContextMenuItem disabled={!editor.hasValue} onClick={() => editor.pasteValue(clip.id, menuKey)}>
              {menuCopy.pasteValue}
            </ContextMenuItem>
          </ContextMenuPopup>
        ) : null}
      </ContextMenu>
    </InspectorSection>
  );
}

/** Right-clicking the pad acts on the transform value last edited, scale by default. */
function lastTransformKey(key: PropertyKey | null): PropertyKey {
  return TRANSFORM_KEYS.find((transform) => transform === key) ?? "scale";
}

/** Right-clicking the sphere acts on the rotation axis last edited, Y by default. */
function lastRotationKey(key: PropertyKey | null): PropertyKey {
  return ROTATION_KEYS.find((rotation) => rotation === key) ?? "rotateY";
}
