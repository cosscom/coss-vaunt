import { describe, expect, it } from "vitest";
import { blurPropertyKeys, resetBlur, resolveBlurSettings, setBlurSettings } from "./blur-settings";
import { createTextClip } from "./storyboard-factories";
import type { Clip } from "./storyboard-schema";

const clip = (properties: Clip["properties"], blur?: Clip["blur"]): Clip => ({
  ...createTextClip({ text: "A", start: 0 }),
  properties,
  blur,
});

describe("resolveBlurSettings", () => {
  it("is off for a clip that never stored blur", () => {
    expect(resolveBlurSettings(clip({})).enabled).toBe(false);
  });

  it("keeps clips saved with a blur strength blurring through lens and auto focus", () => {
    expect(
      resolveBlurSettings(
        clip({ blur: { value: 0, keyframes: [{ id: "k", at: 1, value: 0.4, ease: "linear" }] } })
      )
    ).toEqual({
      enabled: true,
      mode: "lens",
      focus: "auto",
    });
    expect(resolveBlurSettings(clip({ blur: { value: 0, keyframes: [] } })).enabled).toBe(false);
  });

  it("uses stored settings over the strength", () => {
    expect(
      resolveBlurSettings(
        clip({ blur: { value: 0.4, keyframes: [] } }, { enabled: false, mode: "radial", focus: "auto" })
      ).enabled
    ).toBe(false);
  });
});

describe("blur edits", () => {
  it("changes one setting and keeps the rest", () => {
    expect(setBlurSettings(clip({}), { enabled: true }).blur).toEqual({
      enabled: true,
      mode: "lens",
      focus: "auto",
    });
  });

  it("resets the blur properties and settings but stays on", () => {
    const edited = clip(
      {
        blur: { value: 0.9, keyframes: [] },
        focusX: { value: 0.5, keyframes: [] },
        zoom: { value: 2, keyframes: [] },
      },
      { enabled: true, mode: "tilt-shift", focus: "manual" }
    );
    const reset = resetBlur(edited);
    expect(reset.properties).toEqual({ zoom: { value: 2, keyframes: [] } });
    expect(reset.blur).toEqual({ enabled: true, mode: "lens", focus: "auto" });
  });
});

describe("blurPropertyKeys", () => {
  it("lists what each mode reads", () => {
    expect(blurPropertyKeys({ mode: "lens", focus: "auto" })).toEqual([
      "blur",
      "focusRange",
      "focusX",
      "focusY",
    ]);
    expect(blurPropertyKeys({ mode: "lens", focus: "manual" })).toEqual([
      "blur",
      "focusRange",
      "focusDistance",
    ]);
    expect(blurPropertyKeys({ mode: "tilt-shift", focus: "manual" })).toEqual([
      "blur",
      "focusRange",
      "blurAngle",
      "focusX",
      "focusY",
    ]);
  });
});
