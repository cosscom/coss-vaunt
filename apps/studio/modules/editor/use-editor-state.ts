"use client";

import { toastManager } from "@coss/ui/components/toast";
import { updateAudioTrack } from "@coss/vaunt-engine/audio/audio-edits";
import {
  applyMotionPreset,
  type MotionPlacement,
  motionPresetKeys,
} from "@coss/vaunt-engine/catalogues/motion-presets/apply-motion-preset";
import { findMotionPreset } from "@coss/vaunt-engine/catalogues/motion-presets/motion-presets";
import { applyGeneratedClips } from "@coss/vaunt-engine/storyboard/board-generation";
import { type Board, EMPTY_BOARD } from "@coss/vaunt-engine/storyboard/board-schema";
import { syncBoard, syncBoardEdits } from "@coss/vaunt-engine/storyboard/board-sync";
import {
  PROPERTY_KEYS,
  PROPERTY_SPECS,
  type PropertyGroup,
  type PropertyKey,
} from "@coss/vaunt-engine/storyboard/property-specs";
import {
  addKeyframesAt,
  type ClipOnTrack,
  type CopiedKeyframe,
  clipsWithTracks,
  compoundOf,
  copyKeyframes,
  duplicateClips,
  duplicateVideoTrack,
  editLocalTime,
  editTimeFor,
  ensureVideoTrack,
  findClip,
  findClipLocation,
  frameLocalTime,
  insertVideoTrack,
  keyframePasteTime,
  keyframeTimes,
  keyPoseBefore,
  moveClip,
  moveClips,
  pasteClips,
  pasteKeyframes,
  placeClip,
  placeClipNearest,
  quantiseProjectKeyframes,
  removeClips,
  removeKeyframes,
  removeLanes,
  removeTransition,
  removeVideoTrack,
  resetCamera,
  resetProperty,
  resetPropertyGroup,
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
} from "@coss/vaunt-engine/storyboard/storyboard-edits";
import { createRecordingClip, createTextClip } from "@coss/vaunt-engine/storyboard/storyboard-factories";
import {
  type Clip,
  type Ease,
  type Project,
  type ProjectSettings,
  projectSchema,
  type TransitionKind,
} from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { clipEnd } from "@coss/vaunt-engine/storyboard/track-resolution";
import { useRef, useState } from "react";
import { linkTakeRequest } from "./assets/link-take-request";
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
import { createHistory, type ProjectHistory, pushHistory, redo, undo } from "./project-history";
import type { NewClipKind } from "./timeline/timeline-transport";
import { changesLockedTracks, lockedClipIds, withoutLockedClips } from "./track-locks";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.timeline;
const CAMERA_KEYS = PROPERTY_KEYS.filter((key) => PROPERTY_SPECS[key].group === "camera");

function toggled<T>(items: readonly T[], item: T): T[] {
  return items.includes(item) ? items.filter((other) => other !== item) : [...items, item];
}

/** Lanes the author selected or opened on the primary clip; they reset when another clip becomes primary. */
type LaneState = { clipId: string | null; selected: PropertyKey[]; shown: PropertyKey[] };

type EditOptions = { group?: string; selection?: EditorSelection };

/** Whether an edit landed, and why not when it was refused; an edit that changes nothing still counts. */
export type EditResult = { applied: true } | { applied: false; reason: string };

const APPLIED: EditResult = { applied: true };

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
  const [history, setHistoryState] = useState(() =>
    createHistory(quantiseProjectKeyframes(syncBoard(initialProject, initialProject)))
  );
  // Edits apply to the latest history at once rather than in a state updater, so they can say whether they landed.
  const latest = useRef(history);
  const setHistory = (update: (current: ProjectHistory) => ProjectHistory) => {
    const next = update(latest.current);
    if (next === latest.current) return;
    latest.current = next;
    setHistoryState(next);
  };
  /** The last refusal toasted, so a refused drag says so once rather than on every frame. */
  const refusal = useRef<{ group?: string; reason: string } | null>(null);
  /** Scenes being generated: the board keeps them while their clips are replaced. */
  const generatingScenes = useRef<ReadonlySet<string>>(new Set());
  const [rawSelection, setSelection] = useState<EditorSelection>(EMPTY_SELECTION);
  const [focusTransition, setFocusTransition] = useState(false);
  const [lastProperty, setLastProperty] = useState<PropertyKey | null>(null);
  const [clipboard, setClipboard] = useState<ClipOnTrack[] | null>(null);
  const [keyframeClipboard, setKeyframeClipboard] = useState<CopiedKeyframe[] | null>(null);
  const [laneState, setLaneState] = useState<LaneState>({ clipId: null, selected: [], shown: [] });
  const [valueClipboard, setValueClipboard] = useState<number | null>(null);
  const poseTimes = useRef(new Map<string, number>());
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

  /** Every edit, from the timeline, the board or the agent, ends with the board matched to the timeline. */
  const synced = (before: Project, after: Project, { replace = false } = {}) =>
    syncBoardEdits(before, after, { keep: generatingScenes.current, replace });

  const refuse = (reason: string, group?: string): EditResult => {
    if (refusal.current?.reason !== reason || refusal.current.group !== group || !group)
      toastManager.add({ type: "info", title: reason });
    refusal.current = { group, reason };
    return { applied: false, reason };
  };

  /**
   * Applies `update` to the latest project. Edits that change a locked track's clips are dropped, unless `unlocked`
   * (generated clips); with `report`, a dropped edit (a locked track, or a board edit the timeline can't follow)
   * says why in a toast. `replace` is a board replaced wholesale (see `syncBoardEdits`).
   */
  const edit = (
    update: (current: Project) => Project,
    group?: string,
    { unlocked = false, report = false, replace = false } = {}
  ): EditResult => {
    const present = latest.current.present;
    const result = synced(present, update(present), { replace });
    const next = quantiseProjectKeyframes(result.project);
    const [refused] = result.refused;
    const reason = refused
      ? STUDIO_COPY.storyboard.refused[refused]
      : next !== present && !isValid(next)
        ? STUDIO_COPY.storyboard.invalidEdit
        : !unlocked && changesLockedTracks(present, next)
          ? copy.trackLockedRefused
          : null;
    if (reason) return report ? refuse(reason, group) : { applied: false, reason };
    refusal.current = null;
    if (next !== present) setHistory((current) => pushHistory(current, next, { group, now: Date.now() }));
    return APPLIED;
  };

  /**
   * A discrete edit with a toast when it touches a locked track. `update` gets the latest project, not this render's,
   * so an edit that lands after an await (an upload) or right after another edit doesn't undo what came before it.
   */
  const commit = (
    update: (current: Project) => Project,
    { group, selection: nextSelection }: EditOptions = {}
  ) => {
    const present = latest.current.present;
    const next = quantiseProjectKeyframes(synced(present, update(present)).project);
    if (next === present || !isValid(next)) return false;
    if (changesLockedTracks(present, next)) {
      toastManager.add({ type: "info", title: copy.trackLockedRefused });
      return false;
    }
    setHistory((current) => pushHistory(current, next, { group, now: Date.now() }));
    if (nextSelection) {
      setSelection(nextSelection);
      setFocusTransition(false);
    }
    return true;
  };

  /** Selects clips an edit just made, whose ids are only known once it ran. */
  const selectNew = (clipIds: string[]) => {
    setSelection({ clipIds, keyframes: [] });
    setFocusTransition(false);
  };

  const editClip = (clipId: string, update: (clip: Clip) => Clip, group?: string) =>
    edit((current) => updateClip(current, clipId, update), group);

  /** Edits land on the frame grid, in project time, and no later than the clip's last drawn frame. */
  const atPlayhead = (clip: Clip) => editLocalTime(clip, playhead(), project.settings.fps);
  /** A selected keyframe of `keys` at the playhead wins over adding a new one beside it. */
  const editTime = (clip: Clip, keys: readonly PropertyKey[]) =>
    editTimeFor(
      clip,
      keys,
      selection.keyframes.filter((keyframe) => keyframe.clipId === clip.id),
      atPlayhead(clip),
      project.settings.fps
    );
  /** Adding the first keyframes after the clip start also keys the static pose at the start. */
  const posed = (clip: Clip, keys: readonly PropertyKey[], time: number) =>
    keyPoseBefore(clip, keys, time, 0);
  /** Editing `keys` again at another time than their last edit keys that pose first, so the two animate. */
  const editPose = (
    clipId: string,
    keys: readonly PropertyKey[],
    group: string,
    set: (clip: Clip, time: number) => Clip
  ) => {
    const clip = findClip(project, clipId);
    if (!clip) return;
    const time = editTime(clip, keys);
    const poseId = `${clipId}:${keys.join()}`;
    const posedAt = poseTimes.current.get(poseId);
    poseTimes.current.set(poseId, time);
    editClip(
      clipId,
      (current) => set(posedAt === undefined ? current : keyPoseBefore(current, keys, time, posedAt), time),
      group
    );
  };

  const clipsAtPlayhead = () =>
    project.videoTracks
      .flatMap((track) => (track.locked ? [] : track.clips))
      .filter((clip) => playhead() > clip.start && playhead() < clipEnd(clip));

  const withTrack = (current: Project, trackIndex: number) =>
    ensureVideoTrack(current, trackIndex, copy.newTrackName(current.videoTracks.length + 1));

  const placeNew = (clip: Clip, trackIndex: number, nearest: boolean) =>
    commit(
      (current) => (nearest ? placeClipNearest : placeClip)(withTrack(current, trackIndex), trackIndex, clip),
      { selection: { clipIds: [clip.id], keyframes: [] } }
    );

  const newClip = (kind: NewClipKind, start: number) =>
    kind === "recording"
      ? createRecordingClip({
          name: copy.newRecordingName(clipCount(project) + 1),
          route: STUDIO_COPY.routes[0].value,
          start,
        })
      : createTextClip({ text: copy.newTextWords, start });

  const placeSequentially = (clips: Clip[], trackIndex: number, start: number) =>
    commit(
      (current) => {
        let next = withTrack(current, trackIndex);
        let cursor = start;
        for (const clip of clips) {
          next = placeClipNearest(next, trackIndex, { ...clip, start: cursor });
          cursor = clipEnd(findClip(next, clip.id) ?? clip);
        }
        return next;
      },
      { selection: { clipIds: clips.map((clip) => clip.id), keyframes: [] } }
    );

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
    edit: (update: (current: Project) => Project, group?: string) => edit(update, group),
    /** A board action that changes the project (a reorder), saying in a toast when it can't. */
    editScenes: (update: (current: Project) => Project) => edit(update, undefined, { report: true }),
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
          .filter((track, index) => !track.locked && (trackIndex === undefined || index === trackIndex))
          .flatMap((track) => track.clips.map((clip) => clip.id)),
        keyframes: [],
      }),

    deleteSelection: () => {
      if (selection.keyframes.length > 0 && primaryClip) {
        commit(
          (current) =>
            updateClip(current, primaryClip.id, (clip) => removeKeyframes(clip, selection.keyframes)),
          { selection: { ...selection, keyframes: [] } }
        );
        return;
      }
      if (lanes.selected.length > 0 && primaryClip) {
        const removed = lanes.selected;
        commit((current) => updateClip(current, primaryClip.id, (clip) => removeLanes(clip, removed)));
        setLanes((current) => ({
          selected: [],
          shown: current.shown.filter((key) => !removed.includes(key)),
        }));
        return;
      }
      commit((current) => removeClips(current, selection.clipIds), { selection: EMPTY_SELECTION });
    },
    duplicateSelection: () => {
      let clipIds: string[] = [];
      const duplicated = commit((current) => {
        const result = duplicateClips(current, selection.clipIds);
        clipIds = result.clipIds;
        return result.project;
      });
      if (duplicated) selectNew(clipIds);
    },
    splitAtPlayhead: () => {
      const clipIds = selectedOrUnderPlayhead();
      commit((current) =>
        clipIds.reduce((next, clipId) => splitClip(next, clipId, playhead())?.project ?? next, current)
      );
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
      let clipIds: string[] = [];
      const pasted = commit((current) => {
        const result = pasteClips(current, entries, time);
        clipIds = result.clipIds;
        return result.project;
      });
      if (pasted) selectNew(clipIds);
    },

    addClip: (kind: NewClipKind) =>
      placeNew(newClip(kind, playhead()), kind === "recording" ? 0 : project.videoTracks.length - 1, false),
    addClipAt: (kind: NewClipKind, time: number, trackIndex: number) =>
      placeNew(newClip(kind, time), trackIndex, true),
    insertImported: (clip: Clip) => placeNew({ ...clip, start: playhead() }, 0, false),
    /** A clip dragged from the assets pane, already given a fresh id. */
    placeAssetAt: (clip: Clip, time: number, trackIndex: number) =>
      placeNew({ ...clip, start: time }, trackIndex, true),
    /** A take dragged from the assets pane: the new clip gets a copy of `fromClipId`'s frames before it's placed. */
    placeTakeAt: async (clip: Clip, fromClipId: string, time: number, trackIndex: number) => {
      const captureHash = clip.source.kind === "recording" ? clip.source.take : undefined;
      if (!captureHash) return;
      const linked = await linkTakeRequest({
        projectId: project.id,
        clipId: clip.id,
        fromClipId,
        captureHash,
      });
      if (!linked) {
        toastManager.add({ type: "error", title: STUDIO_COPY.assets.takeCopyFailed });
        return;
      }
      placeNew({ ...clip, start: time }, trackIndex, true);
    },
    /** `take` is a capture hash; undefined goes back to the take matching the clip's script. */
    setClipTake: (clipId: string, take: string | undefined) =>
      editClip(clipId, (clip) =>
        clip.source.kind === "recording" ? { ...clip, source: { ...clip.source, take } } : clip
      ),
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
      commit((current) => {
        const clip = findClip(current, clipId);
        return clip ? moveClip(current, clipId, { start: clip.start, trackIndex }) : current;
      });
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
      commit((current) => moveClips(current, selection.clipIds, direction * frame) ?? current, {
        group: "nudge",
      });
    },

    setTransition: (clipId: string, transitionIn: TransitionKind) =>
      editClip(clipId, (clip) => ({ ...clip, transitionIn })),
    setTransitionLength: (clipId: string, seconds: number) =>
      commit((current) => setTransitionLength(current, clipId, seconds)),
    removeTransition: (clipId: string) => commit((current) => removeTransition(current, clipId)),

    touchProperty: setLastProperty,
    /** `group` merges a continuous gesture (slider, sphere, canvas drag) into one undo step. */
    setPropertyAtPlayhead: (
      clipId: string,
      key: PropertyKey,
      value: number,
      group = `property:${clipId}:${key}`
    ) => {
      setLastProperty(key);
      editPose(clipId, [key], group, (clip, time) => setPropertyAt(clip, key, time, value));
    },
    /** Sphere and canvas drags: once any axis of the compound is keyed, every axis is keyed together. */
    setCompoundAtPlayhead: (clipId: string, key: PropertyKey, value: number, group: string) => {
      setLastProperty(key);
      editPose(clipId, compoundOf(key), group, (clip, time) => setCompoundPropertyAt(clip, key, time, value));
    },
    toggleCompoundKeyframe: (clipId: string, key: PropertyKey) => {
      setLastProperty(key);
      const keys = compoundOf(key);
      editClip(clipId, (clip) => {
        const time = editTime(clip, keys);
        return toggleKeyframesAt(posed(clip, keys, time), keys, time);
      });
    },
    toggleKeyframe: (clipId: string, key: PropertyKey) => {
      setLastProperty(key);
      editClip(clipId, (clip) => {
        const time = editTime(clip, [key]);
        return toggleKeyframeAt(posed(clip, [key], time), key, time);
      });
    },
    addKeyframeAtPlayhead: (clipId: string, key: PropertyKey) => {
      setLastProperty(key);
      editClip(clipId, (clip) =>
        addKeyframesAt(posed(clip, [key], atPlayhead(clip)), [key], atPlayhead(clip))
      );
    },
    /** K: the selected lanes, or the property edited last. */
    toggleLastPropertyKeyframe: () => {
      const keys = keyframeTargetKeys(lanes.selected, lastProperty);
      if (primaryClip && keys.length > 0)
        editClip(primaryClip.id, (clip) =>
          toggleKeyframesAt(posed(clip, keys, atPlayhead(clip)), keys, atPlayhead(clip))
        );
    },
    /** Shift+K: every property in the group of the property edited last, camera by default. */
    toggleGroupKeyframes: () => {
      const keys = groupTargetKeys(lastProperty);
      if (primaryClip)
        editClip(primaryClip.id, (clip) =>
          toggleKeyframesAt(posed(clip, keys, atPlayhead(clip)), keys, atPlayhead(clip))
        );
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
      commit((current) => updateClip(current, primaryClip.id, () => result.clip), {
        selection: {
          clipIds: selection.clipIds,
          keyframes: result.refs.map((ref) => ({ ...ref, clipId: primaryClip.id })),
        },
      });
    },
    pasteTimeAfter: (at: number) => keyframePasteTime(at, project.settings.fps),
    selectLane: (key: PropertyKey, additive: boolean) =>
      setLanes((current) => ({
        shown: current.shown,
        selected: additive ? toggled(current.selected, key) : [key],
      })),
    showLane: (key: PropertyKey) =>
      setLanes((current) => ({ selected: [key], shown: [...new Set([...current.shown, key])] })),
    /** Keys a motion preset onto a clip as one undo step, selects the clip and shows the lanes it animated. */
    applyMotionPreset: (clipId: string, presetId: string, placement: MotionPlacement) => {
      const preset = findMotionPreset(presetId);
      if (!preset) return;
      const applied = commit(
        (current) => updateClip(current, clipId, (clip) => applyMotionPreset(clip, preset, placement)),
        { selection: { clipIds: [clipId], keyframes: [] } }
      );
      if (!applied) return;
      const keys = motionPresetKeys(preset);
      const shown = lanes.clipId === clipId ? lanes.shown : [];
      setLaneState({ clipId, selected: [], shown: [...new Set([...shown, ...keys])] });
    },
    addCameraKeyframes: (clipId: string | null = primaryId) => {
      if (clipId)
        editClip(clipId, (clip) =>
          addKeyframesAt(posed(clip, CAMERA_KEYS, atPlayhead(clip)), CAMERA_KEYS, atPlayhead(clip))
        );
    },
    resetCamera: (clipId: string) => editClip(clipId, resetCamera),
    resetPropertyGroup: (clipId: string, group: PropertyGroup) =>
      editClip(clipId, (clip) => resetPropertyGroup(clip, group)),
    resetProperty: (clipId: string, key: PropertyKey) => editClip(clipId, (clip) => resetProperty(clip, key)),
    setKeyframesEase: (clipId: string, refs: SelectedKeyframe[], ease: Ease, group?: string) =>
      editClip(
        clipId,
        (clip) =>
          refs.reduce((current, ref) => setKeyframeEase(current, ref.key, ref.keyframeId, ease), clip),
        group
      ),
    deleteKeyframes: (clipId: string, refs: SelectedKeyframe[]) =>
      editClip(clipId, (clip) => removeKeyframes(clip, refs)),
    jumpToKeyframe: (direction: 1 | -1) => {
      if (!primaryClip) return;
      const refs = selection.keyframes.length > 0 ? selection.keyframes : undefined;
      const local = frameLocalTime(primaryClip, playhead(), project.settings.fps);
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
      commit((current) =>
        insertVideoTrack(current, index, copy.newTrackName(current.videoTracks.length + 1))
      ),
    addTrack: () =>
      commit((current) =>
        insertVideoTrack(
          current,
          current.videoTracks.length,
          copy.newTrackName(current.videoTracks.length + 1)
        )
      ),
    duplicateTrack: (trackIndex: number) =>
      commit((current) =>
        duplicateVideoTrack(current, trackIndex, copy.newTrackName(current.videoTracks.length + 1))
      ),
    deleteTrack: (trackIndex: number) => commit((current) => removeVideoTrack(current, trackIndex)),
    renameTrack: (trackIndex: number, name: string) =>
      commit((current) => updateVideoTrack(current, trackIndex, (track) => ({ ...track, name }))),
    setTrackHidden: (trackIndex: number, hidden: boolean) =>
      commit((current) =>
        updateVideoTrack(current, trackIndex, (track) => ({ ...track, hidden: hidden || undefined }))
      ),
    /** One undo step; locking drops the track's clips from the selection. */
    setTrackLocked: (trackIndex: number, locked: boolean) => {
      const lock = (current: Project) =>
        updateVideoTrack(current, trackIndex, (track) => ({ ...track, locked: locked || undefined }));
      const keep = new Set(withoutLockedClips(selection.clipIds, lock(project)));
      commit(lock, {
        selection: {
          clipIds: selection.clipIds.filter((id) => keep.has(id)),
          keyframes: selection.keyframes.filter((keyframe) => keep.has(keyframe.clipId)),
        },
      });
    },
    /** The audio selection lives with the audio tracks and drops locked clips itself. */
    setAudioTrackLocked: (trackIndex: number, locked: boolean) =>
      commit((current) =>
        updateAudioTrack(current, trackIndex, (track) => ({ ...track, locked: locked || undefined }))
      ),
    lockedClipIds: lockedClipIds(project),
    /** A timeline drag's result, built from the project as the drag started. */
    moveSelection: (next: Project) => commit(() => next),

    board: project.storyboard ?? EMPTY_BOARD,
    /**
     * Board edits share the project's undo history; `group` merges a node drag into one step, and `replace` is a
     * board replaced wholesale (a draft), whose missing scenes keep their clips. A refused edit says why in a toast.
     */
    editBoard: (update: (board: Board) => Board, group?: string, { replace = false } = {}) =>
      edit(
        (current) => {
          const board = current.storyboard ?? EMPTY_BOARD;
          const next = update(board);
          return next === board ? current : { ...current, storyboard: next };
        },
        group,
        { report: true, replace }
      ),
    /** Generated clips arrive while the author keeps editing, so this applies to the latest project. */
    applyGeneratedClips: (nodeId: string, clips: Clip[]) =>
      edit((current) => applyGeneratedClips(current, nodeId, clips), undefined, { unlocked: true }),
    setGeneratingScenes: (nodeIds: ReadonlySet<string>) => {
      generatingScenes.current = nodeIds;
    },
  };
}

export type EditorState = ReturnType<typeof useEditorState>;
