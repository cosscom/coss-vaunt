import { type AudioSegment, voiceTiming } from "@calcom/product-video/audio/audio-schedule";
import { audioGainCurve } from "@calcom/product-video/audio/audio-volume";

const GAIN_SAMPLES_PER_SECOND = 100;
const STOP_RAMP_SECONDS = 0.015;

export type AudioVoice = { source: AudioBufferSourceNode; gain: GainNode };

/**
 * One clip's buffer source through its own gain, which follows the clip's volume, fades and (for
 * music) ducking as a value curve. Returns null when nothing of the segment is left to play.
 */
export function startAudioVoice({
  context,
  destination,
  anchor,
  segment,
  buffer,
  duck,
  onEnded,
}: {
  context: AudioContext;
  destination: AudioNode;
  anchor: { context: number; project: number };
  segment: AudioSegment;
  buffer: AudioBuffer;
  duck: (projectTime: number) => number;
  onEnded: (voice: AudioVoice) => void;
}): AudioVoice | null {
  const timing = voiceTiming(segment, anchor, context.currentTime, buffer.duration);
  if (!timing) return null;
  const source = context.createBufferSource();
  source.buffer = buffer;
  const gain = context.createGain();
  const curve = audioGainCurve({
    clip: segment.clip,
    fromLocal: timing.fromLocal,
    duration: timing.duration,
    samplesPerSecond: GAIN_SAMPLES_PER_SECOND,
    duck: segment.clip.kind === "music" ? duck : undefined,
  });
  gain.gain.value = curve[0] ?? 0;
  gain.gain.setValueCurveAtTime(curve, timing.when, timing.duration);
  source.connect(gain).connect(destination);
  source.start(timing.when, timing.offset, timing.duration);
  const voice = { source, gain };
  source.addEventListener("ended", () => {
    gain.disconnect();
    onEnded(voice);
  });
  return voice;
}

/** A short ramp to silence before stopping, so pausing doesn't click. */
export function silenceAudioVoice({ source, gain }: AudioVoice, at: number): void {
  gain.gain.cancelScheduledValues(at);
  gain.gain.setTargetAtTime(0, at, STOP_RAMP_SECONDS / 3);
  source.stop(at + STOP_RAMP_SECONDS);
}
