import { DUCKING, duckingGainAt, sfxIntervals } from "@coss/vaunt-engine/audio/audio-ducking";
import { audioSegmentsBetween, projectTimeAt } from "@coss/vaunt-engine/audio/audio-schedule";
import type { AudioTrack } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type { PlaybackClock } from "../player/playback-clock";
import { type AudioBufferCache, createAudioBufferCache } from "./audio-buffer-cache";
import { type AudioVoice, silenceAudioVoice, startAudioVoice } from "./audio-voice";

/** Clips due within this many seconds get their sources started ahead, at sample-accurate times. */
const LOOKAHEAD_SECONDS = 1;
/** A jump in the clock bigger than this (a seek, a loop) restarts every source from the new time. */
const RESYNC_SECONDS = 0.05;

type Output = { context: AudioContext; master: GainNode; buffers: AudioBufferCache };
type Run = {
  anchor: { context: number; project: number };
  scheduled: Set<string>;
  voices: Set<AudioVoice>;
  duck: (projectTime: number) => number;
};

export type AudioPlaybackEngine = {
  setTracks: (tracks: readonly AudioTrack[]) => void;
  dispose: () => void;
};

/**
 * Plays audio tracks in step with the editor's clock through Web Audio. While it plays, the clock
 * reads the audio context's time, so video follows audio rather than the other way round.
 */
export function createAudioPlaybackEngine(clock: PlaybackClock, projectId: string): AudioPlaybackEngine {
  let tracks: readonly AudioTrack[] = [];
  let output: Output | null = null;
  let run: Run | null = null;
  let starting = false;

  const hasClips = () => tracks.some((track) => track.clips.length > 0);
  const preload = () => {
    if (!output) return;
    for (const file of new Set(tracks.flatMap((track) => track.clips.map((clip) => clip.file)))) {
      void output.buffers.load(file);
    }
  };

  const ensureOutput = (): Output => {
    if (output) return output;
    const context = new AudioContext({ latencyHint: "interactive" });
    const master = context.createGain();
    master.connect(context.destination);
    context.addEventListener("statechange", () => {
      if (context.state !== "running" && run) stop();
    });
    output = { context, master, buffers: createAudioBufferCache(projectId, context) };
    return output;
  };

  const scheduleAhead = () => {
    if (!output || !run) return;
    const current = run;
    const { context, master, buffers } = output;
    const now = projectTimeAt(current.anchor, context.currentTime);
    for (const segment of audioSegmentsBetween(tracks, now, now + LOOKAHEAD_SECONDS, current.scheduled)) {
      const buffer = buffers.get(segment.clip.file);
      if (!buffer) {
        void buffers.load(segment.clip.file);
        continue;
      }
      current.scheduled.add(segment.clip.id);
      const voice = startAudioVoice({
        context,
        destination: master,
        anchor: current.anchor,
        segment,
        buffer,
        duck: current.duck,
        onEnded: (ended) => current.voices.delete(ended),
      });
      if (voice) current.voices.add(voice);
    }
  };

  const silence = () => {
    if (!run || !output) return;
    for (const voice of run.voices) silenceAudioVoice(voice, output.context.currentTime);
  };

  const begin = () => {
    if (!output) return;
    silence();
    const intervals = sfxIntervals(tracks);
    run = {
      anchor: { context: output.context.currentTime, project: clock.currentTime() },
      scheduled: new Set(),
      voices: new Set(),
      duck: (time) => duckingGainAt(intervals, time, DUCKING),
    };
    scheduleAhead();
  };

  const stop = () => {
    silence();
    run = null;
    clock.setTimeSource(null);
  };

  const play = () => {
    if (starting || !hasClips()) return;
    starting = true;
    // Created on the first play, a user gesture, so the browser lets it start.
    const { context } = ensureOutput();
    preload();
    void context
      .resume()
      .then(() => {
        if (!clock.getState().playing || context.state !== "running") return;
        clock.setTimeSource(() => context.currentTime * 1000);
        begin();
      })
      .finally(() => {
        starting = false;
      });
  };

  const onClock = () => {
    const { playing, time } = clock.getState();
    if (!playing) {
      if (run) stop();
      return;
    }
    if (!run || !output) {
      play();
      return;
    }
    if (Math.abs(time - projectTimeAt(run.anchor, output.context.currentTime)) > RESYNC_SECONDS) begin();
    else scheduleAhead();
  };

  const unsubscribe = clock.subscribe(onClock);

  return {
    setTracks: (next) => {
      if (next === tracks) return;
      tracks = next;
      if (!hasClips()) {
        if (run) stop();
        return;
      }
      preload();
      if (run) begin();
    },
    dispose: () => {
      unsubscribe();
      if (run) stop();
      void output?.context.close();
      output = null;
    },
  };
}
