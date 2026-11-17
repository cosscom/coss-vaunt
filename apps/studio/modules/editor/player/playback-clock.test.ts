import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPlaybackClock } from "./playback-clock";

let now = 0;
let frames: Array<() => void> = [];

const step = (ms: number) => {
  now += ms;
  const pending = frames;
  frames = [];
  for (const callback of pending) callback();
};

beforeEach(() => {
  now = 0;
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", () => {
    frames = [];
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("createPlaybackClock", () => {
  it("advances with wall time while playing and stops on pause", () => {
    const clock = createPlaybackClock(() => now);
    clock.setDuration(4);
    clock.play();
    step(500);
    expect(clock.getState().time).toBeCloseTo(0.5);
    clock.pause();
    step(500);
    expect(clock.getState()).toMatchObject({ time: 0.5, playing: false });
  });

  it("loops at the end, or stops there without loop", () => {
    const clock = createPlaybackClock(() => now);
    clock.setDuration(1);
    clock.play();
    step(1250);
    expect(clock.getState().time).toBeCloseTo(0.25);
    clock.setLoop(false);
    step(1000);
    expect(clock.getState()).toMatchObject({ time: 1, playing: false });
  });

  it("restarts from 0 when played at the end, and keeps playing from a seek", () => {
    const clock = createPlaybackClock(() => now);
    clock.setDuration(2);
    clock.seek(5);
    expect(clock.getState().time).toBe(2);
    clock.play();
    expect(clock.getState().time).toBe(0);
    step(100);
    clock.seek(1);
    step(100);
    expect(clock.getState().time).toBeCloseTo(1.1);
  });

  it("notifies subscribers until they unsubscribe", () => {
    const clock = createPlaybackClock(() => now);
    const listener = vi.fn();
    const unsubscribe = clock.subscribe(listener);
    clock.setDuration(3);
    clock.seek(1);
    unsubscribe();
    clock.seek(2);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("doesn't play an empty timeline", () => {
    const clock = createPlaybackClock(() => now);
    clock.play();
    expect(clock.getState().playing).toBe(false);
  });

  it("follows an external time source from where it was, and falls back to wall time", () => {
    let audio = 50_000;
    const clock = createPlaybackClock(() => now);
    clock.setDuration(10);
    clock.play();
    step(1000);
    clock.setTimeSource(() => audio);
    audio += 250;
    step(1000);
    expect(clock.getState().time).toBeCloseTo(1.25);
    clock.setTimeSource(null);
    step(500);
    expect(clock.getState().time).toBeCloseTo(1.75);
  });

  it("seeks and plays against the external source", () => {
    let audio = 0;
    const clock = createPlaybackClock(() => now);
    clock.setDuration(10);
    clock.setTimeSource(() => audio);
    clock.seek(3);
    clock.play();
    audio += 400;
    expect(clock.currentTime()).toBeCloseTo(3.4);
    expect(clock.getState().time).toBe(3);
    step(16);
    expect(clock.getState().time).toBeCloseTo(3.4);
  });

  it("reports the stored time while paused", () => {
    const clock = createPlaybackClock(() => now);
    clock.setDuration(4);
    clock.seek(2);
    now += 1000;
    expect(clock.currentTime()).toBe(2);
  });
});
