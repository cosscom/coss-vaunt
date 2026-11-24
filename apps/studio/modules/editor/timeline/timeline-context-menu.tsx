"use client";

import {
  ContextMenuGroup,
  ContextMenuGroupLabel,
  ContextMenuItem,
  ContextMenuPopup,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubPopup,
  ContextMenuSubTrigger,
} from "@coss/ui/components/context-menu";
import { PROPERTY_SPECS, type PropertyKey } from "@coss/vaunt-engine/storyboard/property-specs";
import {
  clipLocalTime,
  findClipLocation,
  incomingOverlap,
} from "@coss/vaunt-engine/storyboard/storyboard-edits";
import { EASES, TRANSITION_KINDS } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type * as React from "react";
import { UseTakeSubmenu } from "../assets/use-take-submenu";
import { easeLabel } from "../easing/easing-copy";
import type { SelectedKeyframe } from "../editor-selection";
import { MenuShortcut } from "../menu-shortcut";
import type { PlaybackClock } from "../player/playback-clock";
import type { EditorState } from "../use-editor-state";
import { keysInGroup, laneProperties, PROPERTY_GROUP_ORDER } from "./keyframed-properties";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.timeline.menu;
const TRANSITION_LENGTHS = [0.25, 0.5, 1, 2] as const;
const CUSTOM_EASE = "custom";

/** What was right-clicked, read from the nearest `data-menu` element. */
export type TimelineMenuTarget =
  | { kind: "clip"; clipId: string }
  | { kind: "transition"; clipId: string }
  | { kind: "keyframe"; clipId: string; key: PropertyKey; keyframeId: string }
  | { kind: "lane"; clipId: string; key: PropertyKey }
  | { kind: "track"; trackIndex: number }
  | { kind: "video-lane"; trackIndex: number; time: number }
  | { kind: "audio-lane"; trackIndex: number; time: number }
  | { kind: "empty"; time: number };

type TimelineContextMenuProps = {
  target: TimelineMenuTarget | null;
  editor: EditorState;
  clock: PlaybackClock;
  onImportMedia: (time: number, trackIndex: number) => void;
  onRenameTrack: (trackIndex: number) => void;
  onDeleteTrack: (trackIndex: number) => void;
};

function AddHereItems({
  editor,
  time,
  trackIndex,
  onImportMedia,
}: {
  editor: EditorState;
  time: number;
  trackIndex: number;
  onImportMedia: (time: number, trackIndex: number) => void;
}): React.ReactElement {
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>{copy.addHere}</ContextMenuSubTrigger>
      <ContextMenuSubPopup>
        <ContextMenuItem onClick={() => editor.addClipAt("recording", time, trackIndex)}>
          {copy.recordingClip}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => editor.addClipAt("text", time, trackIndex)}>
          {copy.textClip}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onImportMedia(time, trackIndex)}>{copy.importMedia}</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!editor.canPaste} onClick={() => editor.pasteAt(time, trackIndex)}>
          {copy.paste}
          <MenuShortcut action="paste" />
        </ContextMenuItem>
      </ContextMenuSubPopup>
    </ContextMenuSub>
  );
}

function ClipItems({ editor, clipId }: { editor: EditorState; clipId: string }): React.ReactElement | null {
  const location = findClipLocation(editor.project, clipId);
  if (!location) return null;
  const overlapping = incomingOverlap(location.track, clipId) > 0;
  return (
    <>
      <ContextMenuItem onClick={() => editor.selectClip(clipId)}>{copy.select}</ContextMenuItem>
      <ContextMenuItem onClick={editor.duplicateSelection}>
        {copy.duplicate}
        <MenuShortcut action="duplicate" />
      </ContextMenuItem>
      <ContextMenuItem onClick={editor.splitAtPlayhead}>
        {copy.split}
        <MenuShortcut action="split" />
      </ContextMenuItem>
      <ContextMenuItem onClick={() => editor.copySelection()}>
        {copy.copy}
        <MenuShortcut action="copy" />
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuSub>
        <ContextMenuSubTrigger>{copy.moveToTrack}</ContextMenuSubTrigger>
        <ContextMenuSubPopup>
          {editor.project.videoTracks
            .map((track, index) => ({ track, index }))
            .reverse()
            .map(({ track, index }) => (
              <ContextMenuItem
                disabled={index === location.trackIndex}
                key={track.id}
                onClick={() => editor.moveClipToTrack(clipId, index)}>
                {track.name}
              </ContextMenuItem>
            ))}
        </ContextMenuSubPopup>
      </ContextMenuSub>
      <UseTakeSubmenu clipId={clipId} editor={editor} />
      {overlapping ? (
        <ContextMenuSub>
          <ContextMenuSubTrigger>{copy.transitionIn}</ContextMenuSubTrigger>
          <ContextMenuSubPopup>
            <TransitionKindItems clipId={clipId} editor={editor} />
          </ContextMenuSubPopup>
        </ContextMenuSub>
      ) : null}
      <ContextMenuSub>
        <ContextMenuSubTrigger>{copy.addKeyframe}</ContextMenuSubTrigger>
        <ContextMenuSubPopup>
          <PropertyGroupItems onPick={(key) => editor.addKeyframeAtPlayhead(clipId, key)} />
        </ContextMenuSubPopup>
      </ContextMenuSub>
      <ContextMenuItem onClick={() => editor.resetCamera(clipId)}>{copy.resetCamera}</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={editor.deleteSelection} variant="destructive">
        {copy.delete}
        <MenuShortcut action="delete-selection" />
      </ContextMenuItem>
    </>
  );
}

/** Every animatable property, grouped Device / Camera / Blur / Transform. */
function PropertyGroupItems({
  onPick,
  exclude = [],
}: {
  onPick: (key: PropertyKey) => void;
  exclude?: readonly PropertyKey[];
}): React.ReactElement {
  return (
    <>
      {PROPERTY_GROUP_ORDER.map((group, index) => (
        <ContextMenuGroup key={group}>
          {index > 0 ? <ContextMenuSeparator /> : null}
          <ContextMenuGroupLabel>{copy.groups[group]}</ContextMenuGroupLabel>
          {keysInGroup(group).map((key) => (
            <ContextMenuItem disabled={exclude.includes(key)} key={key} onClick={() => onPick(key)}>
              {PROPERTY_SPECS[key].label}
            </ContextMenuItem>
          ))}
        </ContextMenuGroup>
      ))}
    </>
  );
}

function TransitionKindItems({
  editor,
  clipId,
}: {
  editor: EditorState;
  clipId: string;
}): React.ReactElement {
  const clip = findClipLocation(editor.project, clipId)?.clip;
  return (
    <ContextMenuRadioGroup
      onValueChange={(kind: (typeof TRANSITION_KINDS)[number]) => editor.setTransition(clipId, kind)}
      value={clip?.transitionIn}>
      {TRANSITION_KINDS.map((kind) => (
        <ContextMenuRadioItem key={kind} value={kind}>
          {STUDIO_COPY.transitions[kind]}
        </ContextMenuRadioItem>
      ))}
    </ContextMenuRadioGroup>
  );
}

function KeyframeItems({
  editor,
  clock,
  clipId,
  keyframes,
}: {
  editor: EditorState;
  clock: PlaybackClock;
  clipId: string;
  keyframes: SelectedKeyframe[];
}): React.ReactElement | null {
  const clip = findClipLocation(editor.project, clipId)?.clip;
  const [first] = keyframes;
  const keyframe = first && clip?.properties[first.key]?.keyframes.find((k) => k.id === first.keyframeId);
  if (!clip || !first || !keyframe) return null;
  return (
    <>
      <ContextMenuSub>
        <ContextMenuSubTrigger>{copy.ease}</ContextMenuSubTrigger>
        <ContextMenuSubPopup>
          <ContextMenuRadioGroup
            onValueChange={(value) => {
              const ease = EASES.find((candidate) => candidate === value);
              if (ease) editor.setKeyframesEase(clipId, keyframes, ease);
            }}
            value={typeof keyframe.ease === "string" ? keyframe.ease : CUSTOM_EASE}>
            {EASES.map((ease) => (
              <ContextMenuRadioItem key={ease} value={ease}>
                {STUDIO_COPY.eases[ease]}
              </ContextMenuRadioItem>
            ))}
            {typeof keyframe.ease === "string" ? null : (
              <ContextMenuRadioItem disabled value={CUSTOM_EASE}>
                {easeLabel(keyframe.ease)}
              </ContextMenuRadioItem>
            )}
          </ContextMenuRadioGroup>
        </ContextMenuSubPopup>
      </ContextMenuSub>
      <ContextMenuItem onClick={() => editor.copySelection()}>
        {copy.copy}
        <MenuShortcut action="copy" />
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!editor.canPasteKeyframes}
        onClick={() => editor.pasteKeyframes({ at: editor.pasteTimeAfter(keyframe.at), lane: first.key })}>
        {copy.pasteAfter}
      </ContextMenuItem>
      <ContextMenuItem onClick={() => editor.copyValue(keyframe.value)}>{copy.copyValue}</ContextMenuItem>
      <ContextMenuItem
        onClick={() => {
          clock.pause();
          clock.seek(clip.start + keyframe.at);
        }}>
        {copy.jumpTo}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => editor.deleteKeyframes(clipId, keyframes)} variant="destructive">
        {copy.delete}
        <MenuShortcut action="delete-selection" />
      </ContextMenuItem>
    </>
  );
}

function LaneItems({
  editor,
  clock,
  clipId,
  propertyKey,
}: {
  editor: EditorState;
  clock: PlaybackClock;
  clipId: string;
  propertyKey: PropertyKey;
}) {
  const clip = findClipLocation(editor.project, clipId)?.clip;
  const refs = (clip?.properties[propertyKey]?.keyframes ?? []).map((keyframe) => ({
    clipId,
    key: propertyKey,
    keyframeId: keyframe.id,
  }));
  const shown = clip ? laneProperties(clip, editor.shownLanes).map((lane) => lane.key) : [];
  return (
    <>
      <ContextMenuItem onClick={() => editor.addKeyframeAtPlayhead(clipId, propertyKey)}>
        {copy.addKeyframe}
        <MenuShortcut action="toggle-keyframe" />
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!editor.canPasteKeyframes || !clip}
        onClick={() =>
          clip && editor.pasteKeyframes({ at: clipLocalTime(clip, clock.getState().time), lane: propertyKey })
        }>
        {copy.pasteKeyframe}
        <MenuShortcut action="paste" />
      </ContextMenuItem>
      <ContextMenuItem disabled={refs.length === 0} onClick={() => editor.selectKeyframes(refs, false)}>
        {copy.selectAllKeyframes}
      </ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger>{copy.showLane}</ContextMenuSubTrigger>
        <ContextMenuSubPopup>
          <PropertyGroupItems exclude={shown} onPick={editor.showLane} />
        </ContextMenuSubPopup>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => editor.resetProperty(clipId, propertyKey)}>
        {copy.resetProperty}
      </ContextMenuItem>
      <ContextMenuItem onClick={() => editor.deleteKeyframes(clipId, refs)} variant="destructive">
        {copy.deleteAllKeyframes}
      </ContextMenuItem>
    </>
  );
}

function TrackItems({
  editor,
  trackIndex,
  onRenameTrack,
  onDeleteTrack,
}: {
  editor: EditorState;
  trackIndex: number;
  onRenameTrack: (trackIndex: number) => void;
  onDeleteTrack: (trackIndex: number) => void;
}): React.ReactElement | null {
  const track = editor.project.videoTracks[trackIndex];
  if (!track) return null;
  return (
    <>
      <ContextMenuItem disabled={track.clips.length === 0} onClick={() => editor.selectAllClips(trackIndex)}>
        {copy.selectAll}
      </ContextMenuItem>
      <ContextMenuItem onClick={() => editor.duplicateTrack(trackIndex)}>
        {copy.duplicateTrack}
      </ContextMenuItem>
      <ContextMenuItem onClick={() => editor.insertTrack(trackIndex + 1)}>
        {copy.addTrackAbove}
      </ContextMenuItem>
      <ContextMenuItem onClick={() => editor.insertTrack(trackIndex)}>{copy.addTrackBelow}</ContextMenuItem>
      <ContextMenuItem onClick={() => onRenameTrack(trackIndex)}>{copy.rename}</ContextMenuItem>
      <ContextMenuItem onClick={() => editor.setTrackHidden(trackIndex, !track.hidden)}>
        {track.hidden ? copy.showTrack : copy.hideTrack}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        disabled={editor.project.videoTracks.length <= 1}
        onClick={() => onDeleteTrack(trackIndex)}
        variant="destructive">
        {copy.deleteTrack}
      </ContextMenuItem>
    </>
  );
}

export function TimelineContextMenu({
  target,
  editor,
  clock,
  onImportMedia,
  onRenameTrack,
  onDeleteTrack,
}: TimelineContextMenuProps): React.ReactElement | null {
  if (!target) return null;
  const selectedKeyframes = (clipId: string, key: PropertyKey, keyframeId: string): SelectedKeyframe[] => {
    const selected = editor.selection.keyframes.filter((keyframe) => keyframe.clipId === clipId);
    return selected.some((keyframe) => keyframe.keyframeId === keyframeId)
      ? selected
      : [{ clipId, key, keyframeId }];
  };

  return (
    <ContextMenuPopup className="min-w-56">
      {target.kind === "clip" ? <ClipItems clipId={target.clipId} editor={editor} /> : null}
      {target.kind === "transition" ? (
        <>
          <ContextMenuSub>
            <ContextMenuSubTrigger>{copy.changeKind}</ContextMenuSubTrigger>
            <ContextMenuSubPopup>
              <TransitionKindItems clipId={target.clipId} editor={editor} />
            </ContextMenuSubPopup>
          </ContextMenuSub>
          <ContextMenuSub>
            <ContextMenuSubTrigger>{copy.setLength}</ContextMenuSubTrigger>
            <ContextMenuSubPopup>
              {TRANSITION_LENGTHS.map((seconds) => (
                <ContextMenuItem
                  key={seconds}
                  onClick={() => editor.setTransitionLength(target.clipId, seconds)}>
                  {copy.seconds(seconds)}
                </ContextMenuItem>
              ))}
            </ContextMenuSubPopup>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => editor.removeTransition(target.clipId)} variant="destructive">
            {copy.removeTransition}
          </ContextMenuItem>
        </>
      ) : null}
      {target.kind === "keyframe" ? (
        <KeyframeItems
          clipId={target.clipId}
          clock={clock}
          editor={editor}
          keyframes={selectedKeyframes(target.clipId, target.key, target.keyframeId)}
        />
      ) : null}
      {target.kind === "lane" ? (
        <LaneItems clipId={target.clipId} clock={clock} editor={editor} propertyKey={target.key} />
      ) : null}
      {target.kind === "track" ? (
        <TrackItems
          editor={editor}
          onDeleteTrack={onDeleteTrack}
          onRenameTrack={onRenameTrack}
          trackIndex={target.trackIndex}
        />
      ) : null}
      {target.kind === "video-lane" ? (
        <>
          <AddHereItems
            editor={editor}
            onImportMedia={onImportMedia}
            time={target.time}
            trackIndex={target.trackIndex}
          />
          <ContextMenuSeparator />
          <TrackItems
            editor={editor}
            onDeleteTrack={onDeleteTrack}
            onRenameTrack={onRenameTrack}
            trackIndex={target.trackIndex}
          />
        </>
      ) : null}
      {target.kind === "audio-lane" ? (
        <ContextMenuSub>
          <ContextMenuSubTrigger>{copy.addHere}</ContextMenuSubTrigger>
          <ContextMenuSubPopup>
            <ContextMenuItem disabled>{copy.importAudio}</ContextMenuItem>
          </ContextMenuSubPopup>
        </ContextMenuSub>
      ) : null}
      {target.kind === "empty" ? (
        <>
          <ContextMenuItem onClick={() => editor.addClipAt("recording", target.time, 0)}>
            {copy.recordingClip}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => editor.addClipAt("text", target.time, editor.project.videoTracks.length - 1)}>
            {copy.textClip}
          </ContextMenuItem>
          <ContextMenuItem disabled={!editor.canPaste} onClick={() => editor.pasteAt(target.time)}>
            {copy.paste}
            <MenuShortcut action="paste" />
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={editor.addTrack}>{copy.addTrack}</ContextMenuItem>
        </>
      ) : null}
    </ContextMenuPopup>
  );
}
