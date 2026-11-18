import { describe, expect, it } from "vitest";
import { evaluateProperty } from "../../storyboard/property-evaluation";
import { createTextClip } from "../../storyboard/storyboard-factories";
import { clipSchema } from "../../storyboard/storyboard-schema";
import { applyMotionPreset, motionPresetKeys } from "./apply-motion-preset";
import { findMotionPreset, MOTION_PRESETS, mirrorCubic } from "./motion-presets";

function preset(id: string) {
  const found = findMotionPreset(id);
  if (!found) throw new Error(`No preset ${id}`);
  return found;
}

const frames = (clip: ReturnType<typeof createTextClip>, key: "rotateX" | "opacity" | "x" | "rotateY") =>
  clip.properties[key]?.keyframes.map(({ at, value }) => [Number(at.toFixed(3)), Number(value.toFixed(3))]);

describe("applyMotionPreset", () => {
  it("keys the entrance into the clip's pose at its start and the exit out of it at its end", () => {
    const clip = applyMotionPreset(createTextClip({ text: "Hi", duration: 6 }), preset("flip-up"), "both");
    expect(frames(clip, "rotateX")).toEqual([
      [0, 80],
      [1, 0],
      [5, 0],
      [6, 80],
    ]);
    expect(frames(clip, "opacity")).toEqual([
      [0, 0],
      [1, 1],
      [5, 1],
      [6, 0],
    ]);
    const exit = clip.properties.rotateX?.keyframes.at(-1)?.ease;
    expect(exit).toEqual({ cubic: mirrorCubic(preset("flip-up").ease) });
  });

  it("layers on the clip's own pose: offsets add, opacity and scale multiply", () => {
    const base = createTextClip({ text: "Hi", duration: 6 });
    const posed = {
      ...base,
      properties: { rotateY: { value: 20, keyframes: [] }, opacity: { value: 0.5, keyframes: [] } },
    };
    const clip = applyMotionPreset(posed, preset("swing"), "in");
    expect(frames(clip, "rotateY")).toEqual([
      [0, -35],
      [1, 20],
    ]);
    expect(frames(clip, "opacity")).toEqual([
      [0, 0],
      [1, 0.5],
    ]);
    expect(clip.properties.rotateY?.value).toBe(20);
  });

  it("uses the exit pose when the preset has one", () => {
    const clip = applyMotionPreset(createTextClip({ text: "Hi", duration: 4 }), preset("slide"), "out");
    expect(frames(clip, "x")).toEqual([
      [3.2, 0],
      [4, -1],
    ]);
  });

  it("replaces keyframes inside its windows and keeps the rest of the animation", () => {
    const base = createTextClip({ text: "Hi", duration: 6 });
    const keyed = {
      ...base,
      properties: {
        rotateX: {
          value: 0,
          keyframes: [
            { id: "a", at: 0.5, value: 40, ease: "linear" as const },
            { id: "b", at: 3, value: 10, ease: "linear" as const },
          ],
        },
      },
    };
    const clip = applyMotionPreset(keyed, preset("flip-up"), "in");
    const ids = clip.properties.rotateX?.keyframes.map((keyframe) => keyframe.id);
    expect(ids).not.toContain("a");
    expect(ids).toContain("b");
    // The entrance lands on the pose the clip already had at its end.
    const rest = evaluateProperty(keyed.properties.rotateX, 1);
    expect(clip.properties.rotateX?.keyframes.find((k) => k.at === 1)?.value).toBeCloseTo(rest);
  });

  it("shortens both ends on a short clip so they never meet", () => {
    const clip = applyMotionPreset(createTextClip({ text: "Hi", duration: 1 }), preset("flip-up"), "both");
    expect(frames(clip, "rotateX")).toEqual([
      [0, 80],
      [0.45, 0],
      [0.55, 0],
      [1, 80],
    ]);
  });

  it("keeps every preset valid on any clip", () => {
    for (const candidate of MOTION_PRESETS) {
      for (const duration of [0.3, 2, 12]) {
        const clip = applyMotionPreset(createTextClip({ text: "Hi", duration }), candidate, "both");
        expect(clipSchema.safeParse(clip).success, `${candidate.id} at ${duration} s`).toBe(true);
      }
    }
  });
});

describe("motionPresetKeys", () => {
  it("lists the properties a preset animates", () => {
    expect(motionPresetKeys(preset("swing")).sort()).toEqual(["opacity", "rotateY", "x"]);
  });
});
