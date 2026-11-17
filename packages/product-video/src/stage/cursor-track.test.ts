import { describe, expect, it } from "vitest";
import type { CursorSample } from "../recording/recording-manifest";
import { createCursorTrack, cursorFrameAt, PRESS_RAMP_SECONDS, RIPPLE_SECONDS } from "./cursor-track";

const FPS = 10;
const sample = (x: number, y: number, pressed = false): CursorSample => ({ x, y, pressed, visible: true });

// Rests at (0, 0), moves to (100, 50) over frames 2–4, presses on frames 6–7, then rests.
const samples: CursorSample[] = [
  sample(0, 0),
  sample(0, 0),
  sample(10, 5),
  sample(90, 45),
  sample(100, 50),
  sample(100, 50),
  sample(100, 50, true),
  sample(100, 50, true),
  sample(100, 50),
  sample(100, 50),
];

const track = () => {
  const created = createCursorTrack(samples, FPS);
  if (!created) throw new Error("expected a track");
  return created;
};

describe("createCursorTrack", () => {
  it("has nothing to draw for recordings without cursor samples", () => {
    expect(createCursorTrack(undefined, FPS)).toBeNull();
    expect(createCursorTrack([], FPS)).toBeNull();
    expect(createCursorTrack([{ ...sample(1, 1), visible: false }], FPS)).toBeNull();
  });
});

describe("cursorFrameAt", () => {
  it("starts at the first sample, unpressed", () => {
    expect(cursorFrameAt(track(), 0)).toEqual({ x: 0, y: 0, press: 0, ripple: null });
  });

  it("follows the recorded path mid-move, interpolating between frames", () => {
    const frame = cursorFrameAt(track(), 0.25);
    expect(frame?.x).toBeCloseTo(50);
    expect(frame?.y).toBeCloseTo(25);
  });

  it("lands exactly on the recorded arrival point and stays there", () => {
    expect(cursorFrameAt(track(), 0.4)).toMatchObject({ x: 100, y: 50, press: 0 });
    expect(cursorFrameAt(track(), 0.55)).toMatchObject({ x: 100, y: 50 });
  });

  it("holds the last sample past the end of the recording", () => {
    expect(cursorFrameAt(track(), 5)).toMatchObject({ x: 100, y: 50 });
  });

  it("eases into the press and back out after release", () => {
    expect(cursorFrameAt(track(), 0.6)?.press).toBe(0);
    const sinking = cursorFrameAt(track(), 0.6 + PRESS_RAMP_SECONDS / 2)?.press ?? 0;
    expect(sinking).toBeGreaterThan(0);
    expect(sinking).toBeLessThan(1);
    expect(cursorFrameAt(track(), 0.75)?.press).toBe(1);
    expect(cursorFrameAt(track(), 0.8 + PRESS_RAMP_SECONDS)?.press).toBe(0);
  });

  it("ripples out from the click point from the press until the ripple ends", () => {
    expect(cursorFrameAt(track(), 0.59)?.ripple).toBeNull();
    expect(cursorFrameAt(track(), 0.6)?.ripple).toEqual({ x: 100, y: 50, progress: 0 });
    expect(cursorFrameAt(track(), 0.6 + RIPPLE_SECONDS / 2)?.ripple?.progress).toBeCloseTo(0.5);
    expect(cursorFrameAt(track(), 0.6 + RIPPLE_SECONDS)?.ripple).toBeNull();
  });

  it("hides where the recorder marked the cursor invisible", () => {
    const hidden = createCursorTrack([sample(0, 0), { ...sample(0, 0), visible: false }], FPS);
    expect(hidden && cursorFrameAt(hidden, 0.1)).toBeNull();
  });
});
