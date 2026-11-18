import { describe, expect, it } from "vitest";
import type { Clip, TransitionKind } from "../storyboard/storyboard-schema";
import { activeClipsAt } from "../storyboard/track-resolution";
import { resolveClipLayers } from "./clip-layers";
import { createCursorTrack } from "./cursor-track";

const importClip = (id: string, start: number, transitionIn: TransitionKind, rotateY: number): Clip => ({
  id,
  name: id,
  start,
  duration: 4,
  transitionIn,
  properties: { rotateY: { value: rotateY, keyframes: [] } },
  source: {
    kind: "import",
    file: `imports/${id}.mp4`,
    trimStart: 0,
    fileDuration: 10,
    width: 1920,
    height: 1080,
  },
});

const textClip: Clip = {
  id: "title",
  name: "title",
  start: 0,
  duration: 8,
  transitionIn: "cut",
  properties: {},
  source: { kind: "text", text: "Hi", size: "title", align: "center", weight: 600 },
};

const projectWith = (kind: TransitionKind) => ({
  videoTracks: [
    { id: "t1", name: "Video 1", clips: [importClip("a", 0, "cut", -20), importClip("b", 3, kind, 20)] },
    { id: "t2", name: "Video 2", clips: [textClip] },
  ],
});

const layersAt = (kind: TransitionKind, time: number) =>
  resolveClipLayers(activeClipsAt(projectWith(kind), time));

describe("resolveClipLayers", () => {
  it("leaves text clips to the overlay and passes a lone clip through", () => {
    const [layer, ...rest] = layersAt("crossfade", 1);
    expect(rest).toHaveLength(0);
    expect(layer).toMatchObject({ opacity: 1, blur: 0, scale: 1, x: 0, y: 0 });
    expect(layer?.view.rotateY).toBe(-20);
  });

  it("crossfades by presence and shares the blended device and camera", () => {
    const [outgoing, incoming] = layersAt("crossfade", 3.5);
    expect(outgoing?.active.clip.id).toBe("a");
    expect(outgoing?.opacity).toBeCloseTo(0.5);
    expect(incoming?.opacity).toBeCloseTo(0.5);
    expect(outgoing?.view.rotateY).toBeCloseTo(0);
    expect(incoming?.view.rotateY).toBeCloseTo(0);
  });

  it("blends the camera orbit along with the device rotation", () => {
    const [a, b] = projectWith("crossfade").videoTracks[0]?.clips ?? [];
    if (!a || !b) throw new Error("fixture");
    const orbiting = {
      videoTracks: [
        {
          id: "t1",
          name: "Video 1",
          clips: [
            { ...a, properties: { ...a.properties, cameraY: { value: -10, keyframes: [] } } },
            { ...b, properties: { ...b.properties, cameraY: { value: 30, keyframes: [] } } },
          ],
        },
      ],
    };
    const layers = resolveClipLayers(activeClipsAt(orbiting, 3.5));
    expect(layers.map((layer) => layer.view.cameraY)).toEqual([10, 10]);
  });

  it("blurs the outgoing clip out and the incoming clip in for cross-blur", () => {
    const [outgoing, incoming] = layersAt("cross-blur", 3.25);
    expect(outgoing?.blur).toBeCloseTo(0.25);
    expect(incoming?.blur).toBeCloseTo(0.75);
  });

  it("scales the outgoing clip up and the incoming clip in for zoom-through", () => {
    const [outgoing, incoming] = layersAt("zoom-through", 3.5);
    expect(outgoing?.scale).toBeGreaterThan(1);
    expect(incoming?.scale).toBeLessThan(1);
  });

  it("slides the incoming clip in from the right", () => {
    const [outgoing, incoming] = layersAt("slide", 3.5);
    expect(outgoing?.x).toBeCloseTo(-0.5);
    expect(incoming?.x).toBeCloseTo(0.5);
    expect(incoming?.opacity).toBe(1);
  });

  it("drops the outgoing clip for a cut", () => {
    const layers = layersAt("cut", 3.5);
    expect(layers.map((layer) => layer.active.clip.id)).toEqual(["b"]);
    expect(layers[0]?.view.rotateY).toBe(20);
  });
});

describe("following the cursor", () => {
  const samples = Array.from({ length: 40 }, () => ({ x: 1800, y: 900, pressed: false, visible: true }));
  const track = createCursorTrack(samples, 10);
  const cursor = track ? { track, viewport: { width: 1920, height: 1080 } } : null;
  const sizes = {
    frame: { width: 1600, height: 900 },
    deviceFor: () => ({ width: 16 / 9, height: 1 }),
    cursorFor: () => cursor,
  };
  const drift = {
    focus: { x: 0, y: 0 },
    zoom: 2,
    motion: "none" as const,
    direction: "left" as const,
    intensity: 0,
  };
  const at = (clip: Clip) =>
    resolveClipLayers(activeClipsAt({ videoTracks: [{ id: "t", name: "t", clips: [clip] }] }, 1), sizes)[0];

  it("aims the close-up at the cursor instead of its focus point", () => {
    const still = at({ ...importClip("a", 0, "cut", 0), drift });
    const following = at({ ...importClip("a", 0, "cut", 0), drift: { ...drift, followCursor: true } });
    expect(still?.view.panX).toBeCloseTo(0);
    expect(following?.view.panX).toBeGreaterThan(0.1);
    expect(following?.view.panY).toBeGreaterThan(0.1);
  });

  it("puts the blur's focus on the cursor", () => {
    const blur = { enabled: true, mode: "radial" as const, focus: "auto" as const, followCursor: true };
    const layer = at({ ...importClip("a", 0, "cut", 0), blur });
    expect(layer?.view.focusX).toBeCloseTo(1800 / 960 - 1);
    expect(layer?.view.focusY).toBeCloseTo(900 / 540 - 1);
  });
});
