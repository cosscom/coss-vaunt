import { useSyncExternalStore } from "react";

export type PlaybackState = { time: number; playing: boolean; duration: number; loop: boolean };

/**
 * The editor's single source of time. It lives outside React state so playback re-renders only what
 * reads the time, not the whole editor every frame.
 */
export type PlaybackClock = {
  getState: () => PlaybackState;
  subscribe: (listener: () => void) => () => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  setDuration: (duration: number) => void;
  setLoop: (loop: boolean) => void;
  /**
   * Drives time from another clock in milliseconds (the audio context, so video follows audio), or
   * back from the wall clock with `null`. Time carries on from where it was either way.
   */
  setTimeSource: (source: (() => number) | null) => void;
  /** The time right now, between frames too; equals `getState().time` when paused. */
  currentTime: () => number;
};

export function createPlaybackClock(wallClock: () => number = () => performance.now()): PlaybackClock {
  let state: PlaybackState = { time: 0, playing: false, duration: 0, loop: true };
  const listeners = new Set<() => void>();
  let frame = 0;
  let startedAt = 0;
  let startedTime = 0;
  let now = wallClock;

  const set = (next: Partial<PlaybackState>) => {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  };

  const tick = () => {
    if (!state.playing) return;
    let time = elapsedTime();
    if (time >= state.duration) {
      if (!state.loop || state.duration === 0) {
        set({ time: state.duration, playing: false });
        return;
      }
      time %= state.duration;
      startedTime = time;
      startedAt = now();
    }
    set({ time });
    frame = requestAnimationFrame(tick);
  };

  const clamp = (time: number) => Math.min(state.duration, Math.max(0, time));
  const elapsedTime = () => startedTime + (now() - startedAt) / 1000;

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play: () => {
      if (state.playing || state.duration === 0) return;
      startedTime = state.time >= state.duration ? 0 : state.time;
      startedAt = now();
      set({ playing: true, time: startedTime });
      frame = requestAnimationFrame(tick);
    },
    pause: () => {
      cancelAnimationFrame(frame);
      set({ playing: false });
    },
    toggle() {
      if (state.playing) this.pause();
      else this.play();
    },
    seek: (time) => {
      startedTime = clamp(time);
      startedAt = now();
      set({ time: startedTime });
    },
    setDuration: (duration) => set({ duration, time: Math.min(state.time, duration) }),
    setLoop: (loop) => set({ loop }),
    setTimeSource: (source) => {
      if (state.playing) startedTime = elapsedTime();
      now = source ?? wallClock;
      startedAt = now();
    },
    currentTime: () => (state.playing ? Math.min(state.duration, elapsedTime()) : state.time),
  };
}

export function usePlaybackState<T>(clock: PlaybackClock, select: (state: PlaybackState) => T): T {
  return useSyncExternalStore(
    clock.subscribe,
    () => select(clock.getState()),
    () => select(clock.getState())
  );
}
