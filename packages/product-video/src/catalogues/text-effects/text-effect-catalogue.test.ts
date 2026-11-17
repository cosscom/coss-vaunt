import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import catalog from "./catalog.json";
import { getTextEffect, listTextEffects, loadTextEffects, SHOWCASE_RUNTIME } from "./text-effect-catalogue";

const readJsonDirectory = (name: string): unknown[] =>
  readdirSync(join(__dirname, name))
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(join(__dirname, name, file), "utf8")));

type ExactRecipe = {
  id: string;
  showcase: null | {
    renderer: { id: string };
    runtime: { speed_multiplier: number; y_travel_multiplier: number };
    rendering_contract: { target: string; stagger_mode: string; y_travel_multiplier: number };
    timing: Record<string, { scaled_duration_ms?: number; scaled_stagger_ms?: number; easing?: string }>;
  };
};

describe("text effect catalogue", () => {
  it("loads and validates every spec in specs/", () => {
    const specFiles = readJsonDirectory("specs");
    expect(specFiles).toHaveLength(24);
    expect(
      listTextEffects()
        .map((effect) => effect.id)
        .sort()
    ).toEqual(specFiles.map((spec) => (spec as { id: string }).id).sort());
  });

  it("lists the showcase order first, then the hidden effects", () => {
    const ids = listTextEffects().map((effect) => effect.id);
    expect(ids.slice(0, catalog.visible_ids.length)).toEqual(catalog.visible_ids);
    expect(ids.slice(catalog.visible_ids.length)).toEqual([
      "depth-parallax-words",
      "shared-axis-x",
      "stagger-from-center",
      "stagger-from-edges",
    ]);
  });

  it("finds effects by id and returns undefined for unknown ids", () => {
    expect(getTextEffect("typewriter")?.target).toBe("per-character");
    expect(getTextEffect("not-an-effect")).toBeUndefined();
  });

  describe.each(readJsonDirectory("effects") as ExactRecipe[])(
    "matches the exact recipe for $id",
    (recipe) => {
      const effect = getTextEffect(recipe.id);
      const showcase = recipe.showcase;
      if (!effect || !showcase) return;

      it("uses the same renderer, split, stagger order and runtime", () => {
        expect(effect.renderer.id).toBe(showcase.renderer.id);
        expect(effect.target).toBe(showcase.rendering_contract.target);
        expect(effect.staggerMode).toBe(showcase.rendering_contract.stagger_mode);
        expect(effect.yTravelMultiplier).toBe(showcase.rendering_contract.y_travel_multiplier);
        expect(showcase.runtime.speed_multiplier).toBe(SHOWCASE_RUNTIME.speedMultiplier);
      });

      it("scales timing exactly as the showcase does", () => {
        const { timing } = showcase;
        const { renderer } = effect;
        if (renderer.id === "generic-stagger") {
          expect(effect.enter).toMatchObject({
            durationMs: timing.enter.scaled_duration_ms,
            staggerMs: timing.enter.scaled_stagger_ms,
            easing: timing.enter.easing,
          });
          expect(effect.exit).toMatchObject({
            durationMs: timing.exit.scaled_duration_ms,
            staggerMs: timing.exit.scaled_stagger_ms,
            easing: timing.exit.easing,
          });
        } else if (renderer.id === "shared-slide-opacity-stage") {
          expect(effect.enter.durationMs).toBe(timing.enter_title.scaled_duration_ms);
          expect(effect.enter.staggerMs).toBe(timing.enter_title.scaled_stagger_ms);
          expect(renderer.wordOpacity.durationMs).toBe(timing.enter_word_opacity.scaled_duration_ms);
          expect(effect.exit.durationMs).toBe(timing.exit_title.scaled_duration_ms);
        } else {
          expect(renderer.build).toMatchObject({
            firstWordMs: timing.first_word.scaled_duration_ms,
            pushMs: timing.push.scaled_duration_ms,
            exitMs: timing.exit.scaled_duration_ms,
            easing: timing.push.easing,
            exitEasing: timing.exit.easing,
          });
        }
      });
    }
  );

  it("rejects a spec that animates a property the evaluator doesn't support", () => {
    const [spec] = readJsonDirectory("specs") as { enter: { from: Record<string, unknown> } }[];
    const broken = {
      ...spec,
      enter: { ...spec.enter, from: { ...spec.enter.from, letter_spacing_em: 0.2 } },
    };
    expect(() => loadTextEffects([broken], catalog)).toThrow();
  });

  it("rejects an unsupported easing", () => {
    const [spec] = readJsonDirectory("specs") as { enter: Record<string, unknown> }[];
    expect(() =>
      loadTextEffects([{ ...spec, enter: { ...spec.enter, easing: "spring(1, 100)" } }], catalog)
    ).toThrow();
  });
});
