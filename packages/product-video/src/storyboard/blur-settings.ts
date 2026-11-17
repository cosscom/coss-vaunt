import { PROPERTY_KEYS, PROPERTY_SPECS, type PropertyKey } from "./property-specs";
import type { BlurSettings, Clip } from "./storyboard-schema";

const DEFAULT_BLUR: BlurSettings = { enabled: false, mode: "lens", focus: "auto" };

/**
 * A clip's depth of field settings. Clips saved before the settings existed blur through lens with
 * auto focus whenever they stored a strength above zero.
 */
export function resolveBlurSettings(clip: Pick<Clip, "blur" | "properties">): BlurSettings {
  if (clip.blur) return clip.blur;
  const strength = clip.properties.blur;
  const legacy = strength
    ? [strength.value, ...strength.keyframes.map((k) => k.value)].some((v) => v > 0)
    : false;
  return { ...DEFAULT_BLUR, enabled: legacy };
}

export function setBlurSettings(clip: Clip, change: Partial<BlurSettings>): Clip {
  return { ...clip, blur: { ...resolveBlurSettings(clip), ...change } };
}

/** Back to the default look, keeping whether blur is on. */
export function resetBlur(clip: Clip): Clip {
  const properties = Object.fromEntries(
    Object.entries(clip.properties).filter(
      ([key]) =>
        !PROPERTY_KEYS.some((candidate) => candidate === key && PROPERTY_SPECS[candidate].group === "blur")
    )
  );
  return { ...clip, properties, blur: { ...DEFAULT_BLUR, enabled: resolveBlurSettings(clip).enabled } };
}

/** The blur properties a mode reads; manual lens focus has a distance instead of a point. */
export function blurPropertyKeys(settings: Pick<BlurSettings, "mode" | "focus">): PropertyKey[] {
  const point: PropertyKey[] =
    settings.mode === "lens" && settings.focus === "manual" ? ["focusDistance"] : ["focusX", "focusY"];
  const angle: PropertyKey[] =
    settings.mode === "directional" || settings.mode === "tilt-shift" ? ["blurAngle"] : [];
  return ["blur", "focusRange", ...angle, ...point];
}
