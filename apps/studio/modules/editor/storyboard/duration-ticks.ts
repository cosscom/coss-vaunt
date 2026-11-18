export type DurationTick = { value: number; major: boolean };

const MAX_TICKS = 64;

/** One bar per half second, or per second when that would crowd the ruler; majors every second or every five. */
export function durationTicks(min: number, max: number): DurationTick[] {
  const step = (max - min) / 0.5 + 1 <= MAX_TICKS ? 0.5 : 1;
  const majorEvery = step === 0.5 ? 1 : 5;
  const first = Math.ceil(min / step) * step;
  const ticks: DurationTick[] = [];
  for (let value = first; value <= max + 1e-9; value += step) {
    const rounded = Math.round(value * 2) / 2;
    ticks.push({ value: rounded, major: rounded % majorEvery === 0 });
  }
  return ticks;
}

/** The tick nearest `value`, for the hover and value highlights. */
export function nearestTick(ticks: readonly DurationTick[], value: number): number {
  let best = 0;
  ticks.forEach((tick, index) => {
    if (Math.abs(tick.value - value) < Math.abs((ticks[best]?.value ?? 0) - value)) best = index;
  });
  return best;
}
