"use client";

import { DUCKING, duckingGainAt, sfxIntervals } from "@coss/vaunt-engine/audio/audio-ducking";
import { audioSegmentsBetween } from "@coss/vaunt-engine/audio/audio-schedule";
import type { Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { createAudioBufferCache } from "../editor/audio/audio-buffer-cache";
import { startAudioVoice } from "../editor/audio/audio-voice";

const SAMPLE_RATE = 48_000;

/**
 * The project's audio mixed down offline through the same voices as playback (volume curves, fades, music
 * ducking under effects), so the export sounds as the editor plays it. Null when no unmuted track has a clip.
 */
export async function mixProjectAudio(project: Project, duration: number): Promise<AudioBuffer | null> {
  const tracks = project.audioTracks;
  const segments = audioSegmentsBetween(tracks, 0, duration);
  if (segments.length === 0 || duration <= 0) return null;
  const context = new OfflineAudioContext(2, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
  const buffers = createAudioBufferCache(project.id, context);
  await Promise.all(
    [...new Set(segments.map((segment) => segment.clip.file))].map((file) => buffers.load(file))
  );
  const intervals = sfxIntervals(tracks);
  const duck = (time: number) => duckingGainAt(intervals, time, DUCKING);
  for (const segment of segments) {
    const buffer = buffers.get(segment.clip.file);
    if (!buffer) continue;
    startAudioVoice({
      context,
      destination: context.destination,
      anchor: { context: 0, project: 0 },
      segment,
      buffer,
      duck,
      onEnded: () => undefined,
    });
  }
  return context.startRendering();
}
