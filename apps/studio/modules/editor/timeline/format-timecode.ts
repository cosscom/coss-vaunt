/** `mm:ss.cc`, as editors show it. */
export function formatTimecode(totalSeconds: number): string {
  const hundredths = Math.round(Math.max(0, totalSeconds) * 100);
  const minutes = Math.floor(hundredths / 6000);
  const seconds = Math.floor((hundredths % 6000) / 100);
  const fraction = hundredths % 100;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(fraction).padStart(2, "0")}`;
}
