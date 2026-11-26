export const AUDIO_ROW_HEIGHT_PX = 56;
/** The row's height less the clip's vertical inset and border. */
export const AUDIO_CLIP_INNER_HEIGHT_PX = AUDIO_ROW_HEIGHT_PX - 12 - 2;

/** The clip's inner height in a row resized to `rowHeight`. */
export function audioClipInnerHeight(rowHeight: number): number {
  return Math.max(8, rowHeight - 12 - 2);
}
/** How close to the volume line a press grabs it instead of moving the clip. */
export const VOLUME_LINE_GRAB_PX = 5;
