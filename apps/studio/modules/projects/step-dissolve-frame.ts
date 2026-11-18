/** Tuned in the new-project prototype: a short, soft dissolve on the CSS `ease` curve (“Gentle”). */
export const STEP_DISSOLVE_MS = 142;
export const STEP_DISSOLVE_BLUR_PX = 3;
const SCALE = 0.02;

function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const sample = (a: number, b: number, s: number) =>
    3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let low = 0;
    let high = 1;
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      if (sample(x1, x2, mid) < t) low = mid;
      else high = mid;
    }
    return sample(y1, y2, (low + high) / 2);
  };
}

const gentle = cubicBezier(0.25, 0.1, 0.25, 1);

const smoothstep = (from: number, to: number, t: number) => {
  const k = Math.min(1, Math.max(0, (t - from) / (to - from)));
  return k * k * (3 - 2 * k);
};

export type StepDissolveFrame = {
  /** How far the stage's height has gone from the old step's to the new one's, 0 to 1. */
  height: number;
  leaving: { opacity: number; blur: number; scale: number };
  entering: { opacity: number; blur: number; scale: number };
};

/**
 * One frame of the swap at progress `t`: the old step softens and fades out over the first half while the new one
 * sharpens in, slightly overlapping, each scaling 2% towards or away from the viewer.
 */
export function stepDissolveFrame(t: number): StepDissolveFrame {
  const eased = gentle(t);
  return {
    height: eased,
    leaving: {
      opacity: 1 - smoothstep(0, 0.45, t),
      blur: STEP_DISSOLVE_BLUR_PX * smoothstep(0, 0.5, t),
      scale: 1 - SCALE * eased,
    },
    entering: {
      opacity: smoothstep(0.08, 0.6, t),
      blur: STEP_DISSOLVE_BLUR_PX * (1 - smoothstep(0.1, 0.8, t)),
      scale: 1 + SCALE * (1 - eased),
    },
  };
}
