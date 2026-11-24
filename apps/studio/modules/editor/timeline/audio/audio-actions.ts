import type { Ease } from "@coss/vaunt-engine/storyboard/storyboard-schema";

/** What the audio clip and volume lane menus can do; the selection decides which clips they act on. */
export type AudioActions = {
  duplicate: () => void;
  split: () => void;
  remove: () => void;
  toggleVolumeKeyframe: (clipId: string) => void;
  addVolumeKeyframe: (clipId: string) => void;
  setMuted: (trackIndex: number, muted: boolean) => void;
  setKeyframeEase: (clipId: string, keyframeIds: string[], ease: Ease) => void;
  deleteKeyframes: (clipId: string, keyframeIds: string[]) => void;
};
