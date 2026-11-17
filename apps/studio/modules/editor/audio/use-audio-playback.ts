"use client";

import type { AudioTrack } from "@calcom/product-video/storyboard/storyboard-schema";
import { useEffect, useState } from "react";
import type { PlaybackClock } from "../player/playback-clock";
import { type AudioPlaybackEngine, createAudioPlaybackEngine } from "./audio-playback-engine";

/** Plays the project's audio tracks with the clock for as long as the caller is mounted. */
export function useAudioPlayback(
  tracks: readonly AudioTrack[],
  clock: PlaybackClock,
  projectId: string
): void {
  const [engine, setEngine] = useState<AudioPlaybackEngine | null>(null);

  useEffect(() => {
    const created = createAudioPlaybackEngine(clock, projectId);
    setEngine(created);
    return () => created.dispose();
  }, [clock, projectId]);

  useEffect(() => {
    engine?.setTracks(tracks);
  }, [engine, tracks]);
}
