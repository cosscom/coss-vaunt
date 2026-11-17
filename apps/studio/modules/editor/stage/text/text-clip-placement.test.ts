import type { Clip } from "@calcom/product-video/storyboard/storyboard-schema";
import type { ActiveClip } from "@calcom/product-video/storyboard/track-resolution";
import { describe, expect, it } from "vitest";
import { textClipPlacement } from "./text-clip-placement";

const clip: Clip = {
  id: "title",
  name: "Title",
  start: 0,
  duration: 3,
  transitionIn: "crossfade",
  properties: { opacity: { value: 0.8, keyframes: [] }, x: { value: 0.1, keyframes: [] } },
  source: { kind: "text", text: "Hello", size: "title", align: "center", weight: 600 },
};

const active = (transition: ActiveClip["transition"], presence = 1): ActiveClip => ({
  clip,
  trackIndex: 1,
  localTime: 1,
  presence,
  transition,
});

describe("textClipPlacement", () => {
  it("uses the clip's own properties outside transitions", () => {
    expect(textClipPlacement(active(null))).toEqual({ opacity: 0.8, scale: 1, x: 0.1, y: 0 });
  });

  it("fades by presence during a crossfade", () => {
    expect(
      textClipPlacement(active({ kind: "crossfade", progress: 0.25, role: "incoming" }, 0.25)).opacity
    ).toBeCloseTo(0.2);
  });

  it("hides the outgoing clip of a cut", () => {
    expect(textClipPlacement(active({ kind: "cut", progress: 0.5, role: "outgoing" }, 0.5)).opacity).toBe(0);
    expect(textClipPlacement(active({ kind: "cut", progress: 0.5, role: "incoming" }, 0.5)).opacity).toBe(
      0.8
    );
  });

  it("slides the incoming clip in from the right", () => {
    expect(textClipPlacement(active({ kind: "slide", progress: 0, role: "incoming" }, 0)).x).toBeCloseTo(1.1);
    expect(textClipPlacement(active({ kind: "slide", progress: 1, role: "incoming" }, 1)).x).toBeCloseTo(0.1);
  });
});
