/** `mm:ss.cc`, as editors show it. */
export function formatTimecode(totalSeconds: number): string {
  const hundredths = Math.round(Math.max(0, totalSeconds) * 100);
  const minutes = Math.floor(hundredths / 6000);
  const seconds = Math.floor((hundredths % 6000) / 100);
  const fraction = hundredths % 100;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(fraction).padStart(2, "0")}`;
}

/** `mm:ss:ff`, frames at the project's frame rate, as the transport shows it. */
export function formatFrameTimecode(totalSeconds: number, fps: number): string {
  const frames = Math.floor(Math.max(0, totalSeconds) * fps + 1e-6);
  const perMinute = fps * 60;
  const minutes = Math.floor(frames / perMinute);
  const seconds = Math.floor((frames % perMinute) / fps);
  const frame = frames % fps;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(frame).padStart(2, "0")}`;
}
