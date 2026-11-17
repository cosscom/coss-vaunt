const NEWTON_ITERATIONS = 8;
const NEWTON_EPSILON = 1e-7;
const BISECTION_ITERATIONS = 40;

/**
 * CSS `cubic-bezier(x1, y1, x2, y2)` as a function of progress, solved like browsers do: Newton's method on
 * x(t), falling back to bisection where the slope is flat. x1 and x2 must lie in [0, 1]; y may overshoot.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (progress: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number): number => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;

  const solveT = (x: number): number => {
    let t = x;
    for (let index = 0; index < NEWTON_ITERATIONS; index++) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < NEWTON_EPSILON) return t;
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    let low = 0;
    let high = 1;
    t = x;
    for (let index = 0; index < BISECTION_ITERATIONS; index++) {
      const value = sampleX(t);
      if (Math.abs(value - x) < NEWTON_EPSILON) return t;
      if (value < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return t;
  };

  return (progress) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    return sampleY(solveT(progress));
  };
}
