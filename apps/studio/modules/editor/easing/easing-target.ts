import { findAudioClip } from "@calcom/product-video/audio/audio-edits";
import { sameEase } from "@calcom/product-video/storyboard/keyframe-ease";
import { findClip } from "@calcom/product-video/storyboard/storyboard-edits";
import type { Ease, Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { type AudioSelection, primaryAudioClipId } from "../audio/audio-selection";
import type { EditorSelection, SelectedKeyframe } from "../editor-selection";

/** The selected keyframes the easing editor edits, on the primary video clip or, failing that, audio clip. */
export type EasingTarget =
  | { kind: "video"; clipId: string; refs: SelectedKeyframe[]; eases: Ease[] }
  | { kind: "audio"; clipId: string; keyframeIds: string[]; eases: Ease[] };

export function easingTarget(
  project: Project,
  selection: EditorSelection,
  audio: AudioSelection
): EasingTarget | null {
  const videoClipId = selection.clipIds[selection.clipIds.length - 1];
  const clip = videoClipId ? findClip(project, videoClipId) : null;
  if (clip) {
    const refs: SelectedKeyframe[] = [];
    const eases: Ease[] = [];
    for (const ref of selection.keyframes) {
      if (ref.clipId !== clip.id) continue;
      const keyframe = clip.properties[ref.key]?.keyframes.find((k) => k.id === ref.keyframeId);
      if (!keyframe) continue;
      refs.push(ref);
      eases.push(keyframe.ease);
    }
    if (refs.length > 0) return { kind: "video", clipId: clip.id, refs, eases };
  }

  const audioClipId = primaryAudioClipId(audio);
  const audioClip = audioClipId ? findAudioClip(project, audioClipId)?.clip : null;
  if (!audioClip) return null;
  const keyframes = audioClip.volume.keyframes.filter((k) => audio.keyframeIds.includes(k.id));
  if (keyframes.length === 0) return null;
  return {
    kind: "audio",
    clipId: audioClip.id,
    keyframeIds: keyframes.map((k) => k.id),
    eases: keyframes.map((k) => k.ease),
  };
}

/** Changes when a different set of keyframes is selected. */
export function easingTargetKey(target: EasingTarget | null): string {
  if (!target) return "none";
  if (target.kind === "audio") return target.keyframeIds.join(",");
  return target.refs.map((ref) => ref.keyframeId).join(",");
}

/** The first keyframe's ease, flagged mixed when any other selected keyframe differs. */
export function summariseEases(eases: readonly Ease[]): { ease: Ease; mixed: boolean } | null {
  const [first] = eases;
  if (first === undefined) return null;
  return { ease: first, mixed: eases.some((ease) => !sameEase(ease, first)) };
}
