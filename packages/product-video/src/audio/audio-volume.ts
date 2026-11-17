import { evaluateProperty } from "../storyboard/property-evaluation";
import type { AudioClip } from "../storyboard/storyboard-schema";

type FadeSpan = Pick<AudioClip, "duration" | "fadeIn" | "fadeOut">;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Linear gain ramps up over `fadeIn` from the clip's start and down over `fadeOut` to its end. */
export function fadeGain({ duration, fadeIn, fadeOut }: FadeSpan, localTime: number): number {
  const rampIn = fadeIn > 0 ? clamp01(localTime / fadeIn) : 1;
  const rampOut = fadeOut > 0 ? clamp01((duration - localTime) / fadeOut) : 1;
  return rampIn * rampOut;
}

/** The clip's gain `localTime` seconds into it: keyframed volume times its fades. */
export function audioClipGainAt(clip: Pick<AudioClip, "volume"> & FadeSpan, localTime: number): number {
  return clamp01(evaluateProperty(clip.volume, localTime)) * fadeGain(clip, localTime);
}

/**
 * Gain samples for `AudioParam.setValueCurveAtTime` over `duration` seconds from `fromLocal`, evenly
 * spaced and including both ends. `duck` multiplies in a project-time envelope (music under sfx).
 */
export function audioGainCurve({
  clip,
  fromLocal,
  duration,
  samplesPerSecond,
  duck,
}: {
  clip: Pick<AudioClip, "volume" | "start"> & FadeSpan;
  fromLocal: number;
  duration: number;
  samplesPerSecond: number;
  duck?: (projectTime: number) => number;
}): Float32Array {
  const count = Math.max(2, Math.ceil(duration * samplesPerSecond) + 1);
  const curve = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    const local = fromLocal + (duration * index) / (count - 1);
    curve[index] = audioClipGainAt(clip, local) * (duck ? duck(clip.start + local) : 1);
  }
  return curve;
}
