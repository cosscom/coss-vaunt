"use client";

import {
  PROPERTY_KEYS,
  PROPERTY_SPECS,
  type PropertyKey,
} from "@calcom/product-video/storyboard/property-specs";
import {
  addKeyframesAt,
  type ClipOnTrack,
  type CopiedKeyframe,
  clipsWithTracks,
  compoundOf,
  copyKeyframes,
  duplicateClips,
  duplicateVideoTrack,
  editTimeFor,
  findClip,
  findClipLocation,
  frameLocalTime,
  insertVideoTrack,
  keyframePasteTime,
  keyframeTimes,
  moveClip,
  moveClips,
  pasteClips,
  pasteKeyframes,
  placeClip,
  placeClipNearest,
  quantiseProjectKeyframes,
  removeClips,
  removeKeyframes,
  removeTransition,
  removeVideoTrack,
  resetCamera,
  resetProperty,
  setCompoundPropertyAt,
  setKeyframeEase,
  setPropertyAt,
  setTransitionLength,
  shiftKeyframes,
  splitClip,
  toggleKeyframeAt,
  toggleKeyframesAt,
  updateClip,
  updateVideoTrack,
} from "@calcom/product-video/storyboard/storyboard-edits";
import { createRecordingClip, createTextClip } from "@calcom/product-video/storyboard/storyboard-factories";
import {
  type Clip,
  type Ease,
  type Project,
  type ProjectSettings,
  projectSchema,
  type TransitionKind,
} from "@calcom/product-video/storyboard/storyboard-schema";
import { clipEnd } from "@calcom/product-video/storyboard/track-resolution";
import { useState } from "react";
import {
  type EditorSelection,
  EMPTY_SELECTION,
  primaryClipId,
  pruneSelection,
  type SelectedKeyframe,
  selectClip,
  selectClips,
  selectKeyframes,
} from "./editor-selection";
import { groupTargetKeys, keyframeTargetKeys } from "./keyframe-targets";
import { useMediaImport } from "./media/use-media-import";
import type { PlaybackClock } from "./player/playback-clock";
import { createHistory, pushHistory, redo, undo } from "./project-history";
import type { NewClipKind } from "./timeline/timeline-transport";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.timeline;
const CAMERA_KEYS = PROPERTY_KEYS.filter((key) => PROPERTY_SPECS[key].group === "camera");

function toggled<T>(items: readonly T[], item: T): T[] {
  return items.includes(item) ? items.filter((other) => other !== item) : [...items, item];
}

/** Lanes the author selected or opened on the primary clip; they reset when another clip becomes primary. */
type LaneState = { clipId: string | null; selected: PropertyKey[]; shown: PropertyKey[] };

type EditOptions = { group?: string; selection?: EditorSelection };

/** Edits that would fail validation are dropped, so autosave only ever sends valid projects. */
function isValid(next: Project): boolean {
  return projectSchema.safeParse(next).success;
}

function clipCount(project: Project): number {
  return project.videoTracks.reduce((count, track) => count + track.clips.length, 0);
}

function fileUrl(projectId: string, clip: Clip): string | null {
  if (clip.source.kind !== "import" && clip.source.kind !== "image") return null;
  return `${window.location.origin}/api/projects/${projectId}/files/${clip.source.file}`;
}

/**
 * The editor's project, undo history, selection and every edit the timeline, inspector, menus and
 * shortcuts share. Discrete actions read the latest render; continuous ones go through `edit`.
 */
export function useEditorState(initialProject: Project, clock: PlaybackClock) {
  const [history, setHistory] = useState(() => createHistory(quantiseProjectKeyframes(initialProject)));
  const [rawSelection, setSelection] = useState<EditorSelection>(EMPTY_SELECTION);
  const [focusTransition, setFocusTransition] = useState(false);
  const [lastProperty, setLastProperty] = useState<PropertyKey | null>(null);
  const [clipboard, setClipboard] = useState<ClipOnTrack[] | null>(null);
  const [keyframeClipboard, setKeyframeClipboard] = useState<CopiedKeyframe[] | null>(null);
  const [laneState, setLaneState] = useState<LaneState>({ clipId: null, selected: [], shown: [] });
  const [valueClipboard, setValueClipboard] = useState<number | null>(null);
  const media = useMediaImport(initialProject.id);
  const project = history.present;
  const selection = pruneSelection(rawSelection, project);
  const primaryId = primaryClipId(selection);
  const primaryClip = primaryId ? findClip(project, primaryId) : null;
  const lanes = laneState.clipId === primaryId ? laneState : { clipId: primaryId, selected: [], shown: [] };
  const setLanes = (update: (current: LaneState) => Omit<LaneState, "clipId">) =>
    setLaneState({ clipId: primaryId, ...update(lanes) });
  const playhead = () => clock.getState().time;
  const frame = 1 / project.settings.fps;

  const edit = (update: (current: Project) => Project, group?: string) =>
    setHistory((current) => {
      const next = quantiseProjectKeyframes(update(current.present));
      if (next === current.present || !isValid(next)) return current;
      return pushHistory(current, next, { group, now: Date.now() });
    });

  const commit = (proposed: Project, { group, selection: nextSelection }: EditOptions = {}) => {
    const next = quantiseProjectKeyframes(proposed);
    if (next === project || !isValid(next)) return false;
    setHistory((current) => pushHistory(current, next, { group, now: Date.now() }));
    if (nextSelection) {
      setSelection(nextSelection);
      setFocusTransition(false);
    }
    return true;
  };

  const editClip = (clipId: string, update: (clip: Clip) => Clip, group?: string) =>
    edit((current) => updateClip(current, clipId, update), group);

  /** Edits land on the frame grid, in project time. */
  const atPlayhead = (clip: Clip) => frameLocalTime(clip, playhead(), project.settings.fps);
  /** A selected keyframe of `keys` at the playhead wins over adding a new one beside it. */
  const editTime = (clip: Clip, keys: readonly PropertyKey[]) =>
    editTimeFor(
      clip,
      keys,
      selection.keyframes.filter((keyframe) => keyframe.clipId === clip.id),
      atPlayhead(clip),
      project.settings.fps
    );

  const clipsAtPlayhead = () =>
    project.videoTracks
      .flatMap((track) => track.clips)
      .filter((clip) => playhead() > clip.start && playhead() < clipEnd(clip));

  const placeNew = (clip: Clip, trackIndex: number, nearest: boolean) =>
    commit((nearest ? placeClipNearest : placeClip)(project, trackIndex, clip), {
      selection: { clipIds: [clip.id], keyframes: [] },
    });

  const newClip = (kind: NewClipKind, start: number) =>
    kind === "recording"
      ? createRecordingClip({
          name: copy.newRecordingName(clipCount(project) + 1),
          route: STUDIO_COPY.routes[0].value,
          start,
        })
      : createTextClip({ text: copy.newTextWords, start });

  const placeSequentially = (clips: Clip[], trackIndex: number, start: number) => {
    let next = project;
    let cursor = start;
    for (const clip of clips) {
      next = placeClipNearest(next, trackIndex, { ...clip, start: cursor });
      cursor = clipEnd(findClip(next, clip.id) ?? clip);
    }
    commit(next, { selection: { clipIds: clips.map((clip) => clip.id), keyframes: [] } });
  };

  const selectedOrUnderPlayhead = () =>
    selection.clipIds.length > 0
      ? selection.clipIds
      : clipsAtPlayhead()
          .slice(-1)
          .map((clip) => clip.id);

  return {
    project,
    selection,
    primaryClip,
    focusTransition,
    lastProperty,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    canPaste: clipboard !== null && clipboard.length > 0,
    canPasteKeyframes: keyframeClipboard !== null && keyframeClipboard.length > 0,
    selectedLanes: lanes.selected,
    shownLanes: lanes.shown,
    hasValue: valueClipboard !== null,
    importing: media.importing,
    edit,
    editClip,

    undo: () => setHistory(undo),
    redo: () => setHistory(redo),
    rename: (name: string) => edit((current) => ({ ...current, name }), "name"),
    updateSettings: (settings: Partial<ProjectSettings>, group?: string) =>
      edit((current) => ({ ...current, settings: { ...current.settings, ...settings } }), group),

    selectClip: (clipId: string, { additive = false, transition = false } = {}) => {
      setSelection(selectClip(selection, clipId, additive));
      setFocusTransition(transition);
    },
    selectClips: (clipIds: string[], additive: boolean) =>
      setSelection(selectClips(selection, clipIds, additive)),
    selectKeyframes: (keyframes: SelectedKeyframe[], additive: boolean) =>
      setSelection(selectKeyframes(selection, keyframes, additive)),
    clearSelection: () => setSelection(EMPTY_SELECTION),
    selectAllClips: (trackIndex?: number) =>
      setSelection({
        clipIds: project.videoTracks
          .filter((_, index) => trackIndex === undefined || index === trackIndex)
          .flatMap((track) => track.clips.map((clip) => clip.id)),
        keyframes: [],
      }),

    deleteSelection: () => {
      if (selection.keyframes.length > 0 && primaryClip) {
        commit(
          updateClip(project, primaryClip.id, (clip) => removeKeyframes(clip, selection.keyframes)),
          { selection: { ...selection, keyframes: [] } }
        );
        return;
      }
      commit(removeClips(project, selection.clipIds), { selection: EMPTY_SELECTION });
    },
    duplicateSelection: () => {
      const result = duplicateClips(project, selection.clipIds);
      commit(result.project, { selection: { clipIds: result.clipIds, keyframes: [] } });
    },
    splitAtPlayhead: () => {
      let next = project;
      for (const clipId of selectedOrUnderPlayhead())
        next = splitClip(next, clipId, playhead())?.project ?? next;
      commit(next);
    },
    /** Copies selected keyframes when there are any, otherwise clips; returns a file URL for the system clipboard. */
    copySelection: () => {
      if (selection.keyframes.length > 0 && primaryClip) {
        setKeyframeClipboard(copyKeyframes(primaryClip, selection.keyframes));
        return null;
      }
      const entries = clipsWithTracks(project, selection.clipIds);
      if (entries.length === 0) return null;
      setClipboard(entries);
      return entries.map((entry) => fileUrl(project.id, entry.clip)).find((url) => url !== null) ?? null;
    },
    pasteAt: (time: number, trackIndex?: number) => {
      if (!clipboard) return;
      const entries =
        trackIndex === undefined ? clipboard : clipboard.map((entry) => ({ ...entry, trackIndex }));
      const result = pasteClips(project, entries, time);
      commit(result.project, { selection: { clipIds: result.clipIds, keyframes: [] } });
    },

    addClip: (kind: NewClipKind) =>
      placeNew(newClip(kind, playhead()), kind === "recording" ? 0 : project.videoTracks.length - 1, false),
    addClipAt: (kind: NewClipKind, time: number, trackIndex: number) =>
      placeNew(newClip(kind, time), trackIndex, true),
    insertImported: (clip: Clip) => placeNew({ ...clip, start: playhead() }, 0, false),
    importMediaAt: async (files: File[], time: number, trackIndex: number) => {
      if (files.length === 0) return;
      placeSequentially(await media.importFiles(files), trackIndex, time);
    },
    importMediaAtPlayhead: async (files: File[]) => {
      if (files.length === 0) return;
      const trackIndex = primaryId ? (findClipLocation(project, primaryId)?.trackIndex ?? 0) : 0;
      placeSequentially(await media.importFiles(files), trackIndex, playhead());
    },

    moveClipToTrack: (clipId: string, trackIndex: number) => {
      const clip = findClip(project, clipId);
      if (clip) commit(moveClip(project, clipId, { start: clip.start, trackIndex }));
    },
    nudge: (direction: 1 | -1) => {
      if (selection.keyframes.length > 0 && primaryClip) {
        editClip(
          primaryClip.id,
          (clip) => shiftKeyframes(clip, selection.keyframes, direction * frame),
          "nudge"
        );
        return;
      }
      const next = moveClips(project, selection.clipIds, direction * frame);
      if (next) commit(next, { group: "nudge" });
    },

    setTransition: (clipId: string, transitionIn: TransitionKind) =>
      editClip(clipId, (clip) => ({ ...clip, transitionIn })),
    setTransitionLength: (clipId: string, seconds: number) =>
      commit(setTransitionLength(project, clipId, seconds)),
    removeTransition: (clipId: string) => commit(removeTransition(project, clipId)),

    touchProperty: setLastProperty,
    /** `group` merges a continuous gesture (slider, sphere, canvas drag) into one undo step. */
    setPropertyAtPlayhead: (
      clipId: string,
      key: PropertyKey,
      value: number,
      group = `property:${clipId}:${key}`
    ) => {
      setLastProperty(key);
      editClip(clipId, (clip) => setPropertyAt(clip, key, editTime(clip, [key]), value), group);
    },
    /** Sphere and canvas drags: once any axis of the compound is keyed, every axis is keyed together. */
    setCompoundAtPlayhead: (clipId: string, key: PropertyKey, value: number, group: string) => {
      setLastProperty(key);
      editClip(
        clipId,
        (clip) => setCompoundPropertyAt(clip, key, editTime(clip, compoundOf(key)), value),
        group
      );
    },
    toggleCompoundKeyframe: (clipId: string, key: PropertyKey) => {
      setLastProperty(key);
      editClip(clipId, (clip) => toggleKeyframesAt(clip, compoundOf(key), editTime(clip, compoundOf(key))));
    },
    toggleKeyframe: (clipId: string, key: PropertyKey) => {
      setLastProperty(key);
      editClip(clipId, (clip) => toggleKeyframeAt(clip, key, editTime(clip, [key])));
    },
    addKeyframeAtPlayhead: (clipId: string, key: PropertyKey) => {
      setLastProperty(key);
      editClip(clipId, (clip) => addKeyframesAt(clip, [key], atPlayhead(clip)));
    },
    /** K: the selected lanes, or the property edited last. */
    toggleLastPropertyKeyframe: () => {
      const keys = keyframeTargetKeys(lanes.selected, lastProperty);
      if (primaryClip && keys.length > 0)
        editClip(primaryClip.id, (clip) => toggleKeyframesAt(clip, keys, atPlayhead(clip)));
    },
    /** Shift+K: every property in the group of the property edited last, camera by default. */
    toggleGroupKeyframes: () => {
      const keys = groupTargetKeys(lastProperty);
      if (primaryClip) editClip(primaryClip.id, (clip) => toggleKeyframesAt(clip, keys, atPlayhead(clip)));
    },
    hasKeyframeClipboard: () => keyframeClipboard !== null && keyframeClipboard.length > 0,
    /** Pastes copied keyframes at clip time `at` (default: 5 frames after the last selected keyframe, or the playhead). */
    pasteKeyframes: (options: { at?: number; lane?: PropertyKey } = {}) => {
      if (!primaryClip || !keyframeClipboard) return;
      const anchor = selection.keyframes[selection.keyframes.length - 1];
      const anchorAt = anchor
        ? primaryClip.properties[anchor.key]?.keyframes.find((k) => k.id === anchor.keyframeId)?.at
        : undefined;
      const at =
        options.at ??
        (anchorAt === undefined
          ? atPlayhead(primaryClip)
          : keyframePasteTime(anchorAt, project.settings.fps));
      // Keyframes copied from one property go to the lane they're pasted on; mixed ones keep their own.
      const single = new Set(keyframeClipboard.map((keyframe) => keyframe.key)).size === 1;
      const result = pasteKeyframes(primaryClip, keyframeClipboard, at, single ? options.lane : undefined);
      commit(
        updateClip(project, primaryClip.id, () => result.clip),
        {
          selection: {
            clipIds: selection.clipIds,
            keyframes: result.refs.map((ref) => ({ ...ref, clipId: primaryClip.id })),
          },
        }
      );
    },
    pasteTimeAfter: (at: number) => keyframePasteTime(at, project.settings.fps),
    selectLane: (key: PropertyKey, additive: boolean) =>
      setLanes((current) => ({
        shown: current.shown,
        selected: additive ? toggled(current.selected, key) : [key],
      })),
    showLane: (key: PropertyKey) =>
      setLanes((current) => ({ selected: [key], shown: [...new Set([...current.shown, key])] })),
    addCameraKeyframes: (clipId: string | null = primaryId) => {
      if (clipId) editClip(clipId, (clip) => addKeyframesAt(clip, CAMERA_KEYS, atPlayhead(clip)));
    },
    resetCamera: (clipId: string) => editClip(clipId, resetCamera),
    resetProperty: (clipId: string, key: PropertyKey) => editClip(clipId, (clip) => resetProperty(clip, key)),
    setKeyframesEase: (clipId: string, refs: SelectedKeyframe[], ease: Ease) =>
      editClip(clipId, (clip) =>
        refs.reduce((current, ref) => setKeyframeEase(current, ref.key, ref.keyframeId, ease), clip)
      ),
    deleteKeyframes: (clipId: string, refs: SelectedKeyframe[]) =>
      editClip(clipId, (clip) => removeKeyframes(clip, refs)),
    jumpToKeyframe: (direction: 1 | -1) => {
      if (!primaryClip) return;
      const refs = selection.keyframes.length > 0 ? selection.keyframes : undefined;
      const local = atPlayhead(primaryClip);
      const times = keyframeTimes(primaryClip, refs);
      const target =
        direction > 0
          ? times.find((time) => time > local + 1e-3)
          : [...times].reverse().find((time) => time < local - 1e-3);
      if (target === undefined) return;
      clock.pause();
      clock.seek(primaryClip.start + target);
    },
    copyValue: (value: number) => {
      setValueClipboard(value);
      void navigator.clipboard?.writeText(String(value)).catch(() => undefined);
    },
    pasteValue: (clipId: string, key: PropertyKey) => {
      if (valueClipboard === null) return;
      setLastProperty(key);
      editClip(clipId, (clip) => setPropertyAt(clip, key, atPlayhead(clip), valueClipboard));
    },

    insertTrack: (index: number) =>
      commit(insertVideoTrack(project, index, copy.newTrackName(project.videoTracks.length + 1))),
    addTrack: () =>
      commit(
        insertVideoTrack(
          project,
          project.videoTracks.length,
          copy.newTrackName(project.videoTracks.length + 1)
        )
      ),
    duplicateTrack: (trackIndex: number) =>
      commit(duplicateVideoTrack(project, trackIndex, copy.newTrackName(project.videoTracks.length + 1))),
    deleteTrack: (trackIndex: number) => commit(removeVideoTrack(project, trackIndex)),
    renameTrack: (trackIndex: number, name: string) =>
      commit(updateVideoTrack(project, trackIndex, (track) => ({ ...track, name }))),
    setTrackHidden: (trackIndex: number, hidden: boolean) =>
      commit(updateVideoTrack(project, trackIndex, (track) => ({ ...track, hidden: hidden || undefined }))),
    moveSelection: (next: Project) => commit(next),
  };
}

export type EditorState = ReturnType<typeof useEditorState>;
